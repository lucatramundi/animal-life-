const { app } = require('@azure/functions');
const { authenticateRequest } = require('../lib/authenticate');
const {
	getConversationId,
	getMessagesTableClient,
	isValidUserId
} = require('../lib/chat');
const { requireAllowedUser } = require('../lib/groupAccess');

app.http('messageRead', {
	methods: ['POST'],
	authLevel: 'anonymous',
	route: 'messages/read',
	handler: async (request, context) => {
		try {
			const authenticatedUser = await authenticateRequest(request);
			const requestBody = await request.json();
			const conversationUserId = requestBody?.userId;

			if (!isValidUserId(conversationUserId)) {
				return {
					status: 400,
					jsonBody: { error: 'A valid userId is required.' }
				};
			}

			await requireAllowedUser(
				conversationUserId,
				null,
				'The selected recipient is not a member of the required Entra group.'
			);

			const tableClient = getMessagesTableClient();
			await tableClient.createTable();
			const conversationId = getConversationId(authenticatedUser.id, conversationUserId);
			const readAt = new Date().toISOString();
			const rows = tableClient.listEntities({
				queryOptions: {
					filter: `PartitionKey eq '${conversationId}'`
				}
			});

			for await (const message of rows) {
				if (message.RecipientId !== authenticatedUser.id || message.ReadAt) {
					continue;
				}

				await tableClient.updateEntity({
					partitionKey: conversationId,
					rowKey: message.rowKey,
					ReadAt: readAt
				}, 'Merge');
			}

			return { status: 204 };
		} catch (err) {
			context.error('Message read error:', err);
			return {
				status: err.statusCode || 500,
				jsonBody: {
					error: err.statusCode ? err.message : 'Internal server error.'
				}
			};
		}
	}
});