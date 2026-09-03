const { app } = require('@azure/functions');
const { authenticateRequest } = require('../lib/authenticate');
const { isGraphDirectoryConfigured, searchDirectoryUsers } = require('../lib/graphDirectory');
const { filterUsersByAllowedGroup, getAllowedGroupId } = require('../lib/groupAccess');
const { getUsersTableClient, listKnownUsers, upsertKnownUser, upsertKnownUsers } = require('../lib/users');

const minimumGraphSearchLength = 2;
const defaultUserLimit = 50;
const searchResultLimit = 25;

function normalizeSearchText(rawValue) {
	if (typeof rawValue !== 'string') {
		return '';
	}

	return rawValue.trim().slice(0, 80);
}

function mergeUsers(...userCollections) {
	const mergedUsers = new Map();

	for (const users of userCollections) {
		for (const user of users) {
			if (!user?.id) {
				continue;
			}

			const existingUser = mergedUsers.get(user.id);
			mergedUsers.set(user.id, {
				id: user.id,
				name: user.name || existingUser?.name || user.id,
				username: user.username || existingUser?.username || null,
				source: user.source || existingUser?.source || 'cache'
			});
		}
	}

	return Array.from(mergedUsers.values())
		.sort((first, second) => first.name.localeCompare(second.name));
}

app.http('users', {
	methods: ['GET'],
	authLevel: 'anonymous',
	handler: async (request, context) => {
		try {
			const authenticatedUser = await authenticateRequest(request);
			const searchText = normalizeSearchText(request.query.get('search'));
			const tableClient = getUsersTableClient();
			await tableClient.createTable();

			await upsertKnownUser(tableClient, authenticatedUser, 'signin');

			let graphUsers = [];
			const allowedGroupId = getAllowedGroupId();
			const shouldQueryGraph = isGraphDirectoryConfigured()
				&& (!searchText || searchText.length >= minimumGraphSearchLength);

			if (shouldQueryGraph) {
				graphUsers = await searchDirectoryUsers(searchText, {
					groupId: allowedGroupId,
					limit: searchText ? searchResultLimit : defaultUserLimit
				});
				await upsertKnownUsers(tableClient, graphUsers, 'graph');
			}

			let cachedUsers = await listKnownUsers(tableClient, {
				excludeUserId: authenticatedUser.id,
				searchText,
				limit: searchText ? searchResultLimit : defaultUserLimit
			});
			cachedUsers = await filterUsersByAllowedGroup(cachedUsers);
			const users = mergeUsers(cachedUsers, graphUsers)
				.filter((user) => user.id !== authenticatedUser.id);

			return {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
				jsonBody: {
					users,
					graphConfigured: isGraphDirectoryConfigured()
				}
			};
		} catch (err) {
			context.error('Users error:', err);
			return {
				status: err.statusCode || 500,
				jsonBody: {
					error: err.statusCode ? err.message : 'Internal server error.'
				}
			};
		}
	}
});
