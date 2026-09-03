const { randomUUID } = require('crypto');
const { app } = require('@azure/functions');
const { authenticateRequest } = require('../lib/authenticate');
const {
	getConversationId,
	getMessagesTableClient,
	isValidUserId,
	maximumBodyLength,
	normalizeDisplayName
} = require('../lib/chat');
const { requireAllowedUser } = require('../lib/groupAccess');

function messageResponse(message) {
	return {
		id: message.rowKey,
		senderId: message.SenderId,
		recipientId: message.RecipientId,
		body: message.Body,
		createdAt: message.CreatedAt
	};
}

app.http('messages', {
	methods: ['GET', 'POST'],
	authLevel: 'anonymous',
	handler: async (request, context) => {
		try {
			const authenticatedUser = await authenticateRequest(request);
			const tableClient = getMessagesTableClient();
			await tableClient.createTable();

			if (request.method === 'POST') {
				const requestBody = await request.json();
				const recipientId = requestBody?.recipientId;
				const recipientName = normalizeDisplayName(requestBody?.recipientName, recipientId);
				const body = typeof requestBody?.body === 'string'
					? requestBody.body.trim()
					: '';

				if (!isValidUserId(recipientId)) {
					return {
						status: 400,
						jsonBody: { error: 'A valid recipientId is required.' }
					};
				}

				if (recipientId === authenticatedUser.id) {
					return {
						status: 400,
						jsonBody: { error: 'You cannot send a message to yourself.' }
					};
				}

				await requireAllowedUser(
					recipientId,
					null,
					'The selected recipient is not a member of the required Entra group.'
				);

				if (!body || body.length > maximumBodyLength) {
					return {
						status: 400,
						jsonBody: {
							error: `Message body must contain 1-${maximumBodyLength} characters.`
						}
					};
				}

				const createdAt = new Date().toISOString();
				const message = {
					partitionKey: getConversationId(authenticatedUser.id, recipientId),
					rowKey: `${Date.now().toString().padStart(13, '0')}-${randomUUID()}`,
					SenderId: authenticatedUser.id,
					SenderName: authenticatedUser.name,
					RecipientId: recipientId,
					RecipientName: recipientName,
					Body: body,
					CreatedAt: createdAt
				};

				await tableClient.createEntity(message);

				return {
					status: 201,
					headers: { 'Content-Type': 'application/json' },
					jsonBody: messageResponse(message)
				};
			}

			const recipientId = request.query.get('userId');
			const after = request.query.get('after');

			if (!isValidUserId(recipientId)) {
				return {
					status: 400,
					jsonBody: { error: 'A valid userId query parameter is required.' }
				};
			}

			if (after !== null && (!/^\d+$/.test(after) || Number(after) < 0)) {
				return {
					status: 400,
					jsonBody: { error: 'The after query parameter must be a timestamp.' }
				};
			}

			await requireAllowedUser(
				recipientId,
				null,
				'The selected recipient is not a member of the required Entra group.'
			);

			const conversationId = getConversationId(authenticatedUser.id, recipientId);
			const storedMessages = [];
			const rows = tableClient.listEntities({
				queryOptions: {
					filter: `PartitionKey eq '${conversationId}'`
				}
			});

			for await (const message of rows) {
				const callerIsParticipant = message.SenderId === authenticatedUser.id
					|| message.RecipientId === authenticatedUser.id;

				if (callerIsParticipant && (!after || Date.parse(message.CreatedAt) > Number(after))) {
					storedMessages.push(message);
				}
			}

			storedMessages.sort((first, second) => first.rowKey.localeCompare(second.rowKey));

			return {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				jsonBody: storedMessages.map(messageResponse)
			};
		} catch (err) {
			context.error('Messages error:', err);
			return {
				status: err.statusCode || 500,
				jsonBody: {
					error: err.statusCode ? err.message : 'Internal server error.'
				}
			};
		}
	}
});
