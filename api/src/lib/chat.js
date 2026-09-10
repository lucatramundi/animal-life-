const { TableClient } = require('@azure/data-tables');

const messagesTableName = 'Messages';
const maximumBodyLength = 1000;
const maximumDisplayNameLength = 120;
const maximumVoiceDurationSeconds = 60;
const maximumVoiceMessageSizeBytes = 2 * 1024 * 1024;
const deletedMessageBody = 'This message was deleted.';

function isValidUserId(userId) {
	return typeof userId === 'string'
	&& /^[A-Za-z0-9._-]{1,128}$/.test(userId);
}

function getConversationId(firstUserId, secondUserId) {
	return [firstUserId, secondUserId].sort().join('|');
}

function getMessagesTableClient() {
	return TableClient.fromConnectionString(
		process.env.StorageConnection,
		messagesTableName
	);
}

function isValidMessageId(messageId) {
	return typeof messageId === 'string'
		&& /^\d{13}-[0-9a-fA-F-]{36}$/.test(messageId);
}

function normalizeDisplayName(value, fallbackValue) {
	if (typeof value !== 'string') {
		return fallbackValue;
	}

	const trimmedValue = value.trim();
	if (!trimmedValue) {
		return fallbackValue;
	}

	return trimmedValue.slice(0, maximumDisplayNameLength);
}

function normalizeMessageBody(value) {
	if (typeof value !== 'string') {
		return '';
	}

	return value.trim();
}

function isValidVoiceMimeType(value) {
	if (typeof value !== 'string') {
		return false;
	}

	const normalized = value.trim().split(';', 1)[0].toLowerCase();
	return normalized.startsWith('audio/') && normalized.length > 6 && normalized.length <= 128;
}

function isValidVoiceRecording(value) {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const mimeType = typeof value.mimeType === 'string'
		? value.mimeType
		: typeof value.contentType === 'string'
			? value.contentType
			: '';
	const dataUrl = typeof value.dataUrl === 'string'
		? value.dataUrl
		: typeof value.base64 === 'string'
			? `data:${mimeType || 'audio/webm'};base64,${value.base64}`
			: '';
	const durationSeconds = Number(value.durationSeconds);

	if (!isValidVoiceMimeType(mimeType) || !dataUrl.startsWith('data:')) {
		return false;
	}

	return Number.isFinite(durationSeconds)
		&& durationSeconds > 0
		&& durationSeconds <= maximumVoiceDurationSeconds;
}

function isDeletedMessage(message) {
	return typeof message?.DeletedAt === 'string' && Boolean(message.DeletedAt);
}

function getMessageActivityAt(message) {
	return message?.DeletedAt || message?.UpdatedAt || message?.CreatedAt || '';
}

function canMutateMessage(message, currentUserId) {
	return message?.SenderId === currentUserId && !isDeletedMessage(message);
}

module.exports = {
	canMutateMessage,
	deletedMessageBody,
	getMessageActivityAt,
	getConversationId,
	getMessagesTableClient,
	isDeletedMessage,
	isValidMessageId,
	isValidUserId,
	isValidVoiceRecording,
	maximumBodyLength,
	maximumVoiceDurationSeconds,
	maximumVoiceMessageSizeBytes,
	normalizeDisplayName,
	normalizeMessageBody,
	isValidVoiceMimeType
};
