const { TableClient } = require('@azure/data-tables');

const messagesTableName = 'Messages';
const maximumBodyLength = 1000;
const maximumDisplayNameLength = 120;
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
	maximumBodyLength,
	normalizeDisplayName,
	normalizeMessageBody
};
