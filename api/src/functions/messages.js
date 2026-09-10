const { randomUUID } = require('crypto');
const {
	BlobSASPermissions,
	BlobServiceClient,
	StorageSharedKeyCredential,
	generateBlobSASQueryParameters
} = require('@azure/storage-blob');
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
	isValidVoiceRecording,
	maximumBodyLength,
	maximumVoiceDurationSeconds,
	maximumVoiceMessageSizeBytes,
	normalizeDisplayName,
	normalizeMessageBody
} = require('../lib/chat');
const { requireAllowedUser } = require('../lib/groupAccess');

function getStorageAccountSettings() {
	const connectionString = process.env.StorageConnection;
	if (!connectionString) {
		throw new Error('StorageConnection is not configured.');
	}
	if (connectionString === 'UseDevelopmentStorage=true') {
		return null;
	}

	const settings = {};
	for (const part of connectionString.split(';')) {
		if (!part || !part.includes('=')) {
			continue;
		}
		const separatorIndex = part.indexOf('=');
		settings[part.slice(0, separatorIndex)] = part.slice(separatorIndex + 1);
	}

	if (!settings.AccountName || !settings.AccountKey) {
		throw new Error('StorageConnection is missing the Azure Storage account credentials.');
	}

	return settings;
}

function getAudioExtension(mimeType) {
	const normalizedMimeType = String(mimeType || 'audio/webm').toLowerCase().split(';', 1)[0];
	const extensionMap = {
		'audio/webm': '.webm',
		'audio/mp4': '.m4a',
		'audio/mpeg': '.mp3',
		'audio/ogg': '.ogg',
		'audio/wav': '.wav',
		'audio/aac': '.aac'
	};

	return extensionMap[normalizedMimeType] || '.bin';
}

function parseVoiceDataUrl(dataUrl) {
	if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
		return null;
	}

	const metadataEnd = dataUrl.indexOf(',');
	if (metadataEnd === -1) {
		return null;
	}

	const metadata = dataUrl.slice(5, metadataEnd);
	const base64Payload = dataUrl.slice(metadataEnd + 1);
	if (!base64Payload || !metadata.includes('audio/')) {
		return null;
	}

	const mimeType = metadata.split(';', 1)[0].toLowerCase();
	return { mimeType, payload: base64Payload };
}

async function storeVoiceMessage(voiceRecording) {
	const { mimeType, payload } = parseVoiceDataUrl(voiceRecording.dataUrl || voiceRecording.base64 && `data:${voiceRecording.mimeType || 'audio/webm'};base64,${voiceRecording.base64}`) || {};
	if (!mimeType || !payload) {
		throw new Error('The uploaded voice message is not valid audio data.');
	}

	const audioData = Buffer.from(payload, 'base64');
	if (audioData.length === 0 || audioData.length > maximumVoiceMessageSizeBytes) {
		throw new Error(`Voice message size must be between 1 byte and ${maximumVoiceMessageSizeBytes} bytes.`);
	}

	const storageSettings = getStorageAccountSettings();
	const serviceClient = BlobServiceClient.fromConnectionString(process.env.StorageConnection);
	const containerClient = serviceClient.getContainerClient('voice-messages');
	// Real storage accounts disallow public access; SAS URLs are used instead. Azurite has no such restriction.
	await containerClient.createIfNotExists(storageSettings ? undefined : { access: 'blob' });

	const blobName = `voice-${Date.now()}-${randomUUID()}${getAudioExtension(mimeType)}`;
	const blockBlobClient = containerClient.getBlockBlobClient(blobName);
	await blockBlobClient.uploadData(audioData, {
		blobHTTPHeaders: {
			blobContentType: mimeType
		}
	});


	const voiceUrl = storageSettings
		? `${blockBlobClient.url}?${generateBlobSASQueryParameters({
			containerName: containerClient.containerName,
			blobName,
			permissions: BlobSASPermissions.parse('r'),
			startsOn: new Date(Date.now() - 60 * 1000),
			expiresOn: new Date(Date.now() + 24 * 60 * 60 * 1000)
		}, new StorageSharedKeyCredential(storageSettings.AccountName, storageSettings.AccountKey)).toString()}`
		: blockBlobClient.url;

	return {
		voiceUrl,
		voiceMimeType: mimeType,
		voiceDurationSeconds: Number(voiceRecording.durationSeconds)
	};
}

function messageResponse(message, currentUserId) {
	const deleted = isDeletedMessage(message);
	const canEdit = canMutateMessage(message, currentUserId) && !message.VoiceUrl;
	const canDelete = canMutateMessage(message, currentUserId);

	return {
		id: message.rowKey,
		senderId: message.SenderId,
		recipientId: message.RecipientId,
		body: message.Body,
		createdAt: message.CreatedAt,
		updatedAt: message.UpdatedAt || null,
		deletedAt: message.DeletedAt || null,
		readAt: message.ReadAt || null,
		voiceUrl: message.VoiceUrl || null,
		voiceMimeType: message.VoiceMimeType || null,
		voiceDurationSeconds: message.VoiceDurationSeconds ? Number(message.VoiceDurationSeconds) : null,
		isEdited: !deleted && typeof message.UpdatedAt === 'string' && message.UpdatedAt !== message.CreatedAt,
		isDeleted: deleted,
		canEdit,
		canDelete
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
				const voiceRecording = requestBody?.voice;

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

				let voiceMessageMetadata = null;
				let finalBody = body;
				if (voiceRecording) {
					if (!isValidVoiceRecording(voiceRecording)) {
						return badRequest(`Voice notes must be valid audio data under ${maximumVoiceDurationSeconds} seconds.`);
					}

					voiceMessageMetadata = await storeVoiceMessage(voiceRecording);
					finalBody = body || 'Voice message';
				}

				if (!finalBody || finalBody.length > maximumBodyLength) {
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
					Body: finalBody,
					CreatedAt: createdAt,
					...(voiceMessageMetadata ? {
						VoiceUrl: voiceMessageMetadata.voiceUrl,
						VoiceMimeType: voiceMessageMetadata.voiceMimeType,
						VoiceDurationSeconds: voiceMessageMetadata.voiceDurationSeconds
					} : {})
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

				if (storedMessage.VoiceUrl) {
					return {
						status: 400,
						jsonBody: { error: 'Voice notes cannot be edited.' }
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
