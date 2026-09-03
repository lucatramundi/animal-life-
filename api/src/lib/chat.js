const { TableClient } = require('@azure/data-tables');

const messagesTableName = 'Messages';
const maximumBodyLength = 1000;
const maximumDisplayNameLength = 120;

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

module.exports = {
	getConversationId,
	getMessagesTableClient,
	isValidUserId,
	maximumBodyLength,
	normalizeDisplayName
};
