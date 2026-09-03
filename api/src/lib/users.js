const { TableClient } = require('@azure/data-tables');
const { normalizeDisplayName } = require('./chat');

const usersTableName = 'Users';
const usersPartitionKey = 'Directory';
const maximumUsernameLength = 320;

function getUsersTableClient() {
	return TableClient.fromConnectionString(
		process.env.StorageConnection,
		usersTableName
	);
}

function normalizeUsername(value) {
	if (typeof value !== 'string') {
		return null;
	}

	const trimmedValue = value.trim();
	if (!trimmedValue) {
		return null;
	}

	return trimmedValue.slice(0, maximumUsernameLength);
}

function createDirectoryUserEntity(user, source) {
	return {
		partitionKey: usersPartitionKey,
		rowKey: user.id,
		DisplayName: normalizeDisplayName(user.name, user.id),
		UserPrincipalName: normalizeUsername(user.username),
		Source: source,
		UpdatedAt: new Date().toISOString()
	};
}

async function upsertKnownUser(tableClient, user, source) {
	if (!user?.id) {
		return;
	}

	await tableClient.upsertEntity(
		createDirectoryUserEntity(user, source),
		'Merge'
	);
}

async function upsertKnownUsers(tableClient, users, source) {
	for (const user of users) {
		await upsertKnownUser(tableClient, user, source);
	}
}

function isUserMatch(user, searchText) {
	if (!searchText) {
		return true;
	}

	const normalizedSearchText = searchText.toLowerCase();
	return user.name.toLowerCase().includes(normalizedSearchText)
		|| (user.username || '').toLowerCase().includes(normalizedSearchText)
		|| user.id.toLowerCase().includes(normalizedSearchText);
}

async function listKnownUsers(tableClient, { excludeUserId, searchText, limit }) {
	const users = [];
	const rows = tableClient.listEntities({
		queryOptions: { filter: `PartitionKey eq '${usersPartitionKey}'` }
	});

	for await (const row of rows) {
		if (!row.rowKey || row.rowKey === excludeUserId) {
			continue;
		}

		const user = {
			id: row.rowKey,
			name: normalizeDisplayName(row.DisplayName, row.rowKey),
			username: normalizeUsername(row.UserPrincipalName),
			source: row.Source || 'cache'
		};

		if (!isUserMatch(user, searchText)) {
			continue;
		}

		users.push(user);
	}

	users.sort((first, second) => first.name.localeCompare(second.name));
	return typeof limit === 'number' ? users.slice(0, limit) : users;
}

module.exports = {
	getUsersTableClient,
	listKnownUsers,
	upsertKnownUser,
	upsertKnownUsers
};
