const { randomUUID } = require('crypto');
const { app } = require('@azure/functions');
const { authenticateRequest } = require('../lib/authenticate');
const {
	canMutateMessage,
	deletedMessageBody,
	getConversationId,
	getMessagesTableClient,
	getMessageActivityAt,
	isDeletedMessage,
	isValidMessageId,
	isValidUserId,
	maximumBodyLength,
	normalizeDisplayName,
	normalizeMessageBody
} = require('../lib/chat');
const { requireAllowedUser } = require('../lib/groupAccess');

function messageResponse(message, currentUserId) {
	const deleted = isDeletedMessage(message);

	return {
		id: message.rowKey,
		senderId: message.SenderId,
		recipientId: message.RecipientId,
		body: message.Body,
		createdAt: message.CreatedAt,
		updatedAt: message.UpdatedAt || null,
		deletedAt: message.DeletedAt || null,
		readAt: message.ReadAt || null,
		isEdited: !deleted && typeof message.UpdatedAt === 'string' && message.UpdatedAt !== message.CreatedAt,
		isDeleted: deleted,
		canEdit: canMutateMessage(message, currentUserId),
		canDelete: canMutateMessage(message, currentUserId)
	};
}

function badRequest(message) {
	return {
		status: 400,
		jsonBody: { error: message }
	};
}

function notFound(message) {
	return {
		status: 404,
		jsonBody: { error: message }
	};
}

function forbidden(message) {
	return {
		status: 403,
		jsonBody: { error: message }
	};
}

async function getStoredMessage(tableClient, conversationId, messageId) {
	try {
		return await tableClient.getEntity(conversationId, messageId);
	} catch (error) {
		if (error.statusCode === 404) {
			return null;
		}

		throw error;
	}
}

app.http('messages', {
	methods: ['GET', 'POST', 'PATCH', 'DELETE'],
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
				const body = normalizeMessageBody(requestBody?.body);

				if (!isValidUserId(recipientId)) {
					return badRequest('A valid recipientId is required.');
				}

				if (recipientId === authenticatedUser.id) {
					return badRequest('You cannot send a message to yourself.');
				}

				await requireAllowedUser(
					recipientId,
					null,
					'The selected recipient is not a member of the required Entra group.'
				);

				if (!body || body.length > maximumBodyLength) {
					return badRequest(`Message body must contain 1-${maximumBodyLength} characters.`);
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
					jsonBody: messageResponse(message, authenticatedUser.id)
				};
			}

			if (request.method === 'PATCH' || request.method === 'DELETE') {
				const requestBody = await request.json();
				const conversationUserId = requestBody?.userId;
				const messageId = requestBody?.messageId;

				if (!isValidUserId(conversationUserId)) {
					return badRequest('A valid userId is required.');
				}

				if (!isValidMessageId(messageId)) {
					return badRequest('A valid messageId is required.');
				}

				await requireAllowedUser(
					conversationUserId,
					null,
					'The selected recipient is not a member of the required Entra group.'
				);

				const conversationId = getConversationId(authenticatedUser.id, conversationUserId);
				const storedMessage = await getStoredMessage(tableClient, conversationId, messageId);
				if (!storedMessage) {
					return notFound('The selected message was not found.');
				}

				if (storedMessage.SenderId !== authenticatedUser.id || storedMessage.RecipientId !== conversationUserId) {
					return forbidden('You can only change messages that you sent in this conversation.');
				}

				if (request.method === 'DELETE') {
					if (!isDeletedMessage(storedMessage)) {
						const deletedAt = new Date().toISOString();
						await tableClient.updateEntity({
							partitionKey: conversationId,
							rowKey: messageId,
							Body: deletedMessageBody,
							DeletedAt: deletedAt
						}, 'Merge');
						storedMessage.Body = deletedMessageBody;
						storedMessage.DeletedAt = deletedAt;
					}

					return {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
						jsonBody: messageResponse(storedMessage, authenticatedUser.id)
					};
				}

				if (isDeletedMessage(storedMessage)) {
					return {
						status: 409,
						jsonBody: { error: 'Deleted messages cannot be edited.' }
					};
				}

				const body = normalizeMessageBody(requestBody?.body);
				if (!body || body.length > maximumBodyLength) {
					return badRequest(`Message body must contain 1-${maximumBodyLength} characters.`);
				}

				if (body !== storedMessage.Body) {
					const updatedAt = new Date().toISOString();
					await tableClient.updateEntity({
						partitionKey: conversationId,
						rowKey: messageId,
						Body: body,
						UpdatedAt: updatedAt
					}, 'Merge');
					storedMessage.Body = body;
					storedMessage.UpdatedAt = updatedAt;
				}

				return {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
					jsonBody: messageResponse(storedMessage, authenticatedUser.id)
				};
			}

			const recipientId = request.query.get('userId');
			const after = request.query.get('after');

			if (!isValidUserId(recipientId)) {
				return badRequest('A valid userId query parameter is required.');
			}

			if (after !== null && (!/^\d+$/.test(after) || Number(after) < 0)) {
				return badRequest('The after query parameter must be a timestamp.');
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

				if (callerIsParticipant && (!after || Date.parse(getMessageActivityAt(message)) > Number(after))) {
					storedMessages.push(message);
				}
			}

			storedMessages.sort((first, second) => first.rowKey.localeCompare(second.rowKey));

			return {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				jsonBody: storedMessages.map((message) => messageResponse(message, authenticatedUser.id))
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
