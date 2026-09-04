const { app } = require('@azure/functions');
const { authenticateRequest } = require('../lib/authenticate');
const { filterUsersByAllowedGroup } = require('../lib/groupAccess');
const {
	getMessageActivityAt,
	getMessagesTableClient,
	normalizeDisplayName
} = require('../lib/chat');

function getConversationPartner(message, currentUserId) {
	const senderIsCurrentUser = message.SenderId === currentUserId;
	const partnerId = senderIsCurrentUser ? message.RecipientId : message.SenderId;
	const partnerName = senderIsCurrentUser
		? normalizeDisplayName(message.RecipientName, partnerId)
		: normalizeDisplayName(message.SenderName, partnerId);

	return {
		id: partnerId,
		name: partnerName
	};
}

app.http('conversations', {
	methods: ['GET'],
	authLevel: 'anonymous',
	handler: async (request, context) => {
		try {
			const authenticatedUser = await authenticateRequest(request);
			const tableClient = getMessagesTableClient();
			await tableClient.createTable();

			const summariesByPartnerId = new Map();
			const rows = tableClient.listEntities();

			for await (const message of rows) {
				const callerIsParticipant = message.SenderId === authenticatedUser.id
					|| message.RecipientId === authenticatedUser.id;
				if (!callerIsParticipant) {
					continue;
				}

				const partner = getConversationPartner(message, authenticatedUser.id);
				if (!partner.id) {
					continue;
				}

				const lastActivityAt = getMessageActivityAt(message);
				const existingSummary = summariesByPartnerId.get(partner.id);
				if (existingSummary && existingSummary.lastMessageAt >= lastActivityAt) {
					continue;
				}

				summariesByPartnerId.set(partner.id, {
					id: partner.id,
					name: partner.name,
					lastMessageAt: lastActivityAt,
					lastMessagePreview: message.Body
				});
			}

			const recentConversations = await filterUsersByAllowedGroup(
				Array.from(summariesByPartnerId.values())
			);
			recentConversations.sort((first, second) => second.lastMessageAt.localeCompare(first.lastMessageAt));

			return {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				jsonBody: recentConversations
			};
		} catch (err) {
			context.error('Conversations error:', err);
			return {
				status: err.statusCode || 500,
				jsonBody: {
					error: err.statusCode ? err.message : 'Internal server error.'
				}
			};
		}
	}
});
