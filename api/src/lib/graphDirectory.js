const graphScope = process.env.ENTRA_GRAPH_SCOPE || 'https://graph.microsoft.com/.default';
const maximumGraphUsers = 25;
const maximumGraphPageSize = 100;
const maximumGraphScannedUsers = 500;

let cachedAccessToken = null;
let accessTokenExpiresAt = 0;

function getGraphTenantId() {
	return process.env.AZURE_TENANT_ID;
}

function getGraphClientId() {
	return (process.env.AZURE_CLIENT_ID || '')
		.replace(/^api:\/\//, '');
}

function getGraphClientSecret() {
	return process.env.AZURE_CLIENT_SECRET;
}

function isGraphDirectoryConfigured() {
	return Boolean(getGraphTenantId() && getGraphClientId() && getGraphClientSecret());
}

function escapeODataString(value) {
	return value.replace(/'/g, "''");
}

async function getGraphAccessToken() {
	if (cachedAccessToken && Date.now() < accessTokenExpiresAt) {
		return cachedAccessToken;
	}

	const response = await fetch(
		`https://login.microsoftonline.com/${getGraphTenantId()}/oauth2/v2.0/token`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: getGraphClientId(),
				client_secret: getGraphClientSecret(),
				scope: graphScope,
				grant_type: 'client_credentials'
			})
		}
	);

	const result = await response.json();
	if (!response.ok || typeof result.access_token !== 'string') {
		const error = new Error(result.error_description || 'Unable to acquire a Microsoft Graph access token.');
		error.statusCode = 502;
		throw error;
	}

	cachedAccessToken = result.access_token;
	accessTokenExpiresAt = Date.now() + (Math.max((result.expires_in || 300) - 60, 60) * 1000);
	return cachedAccessToken;
}

async function fetchGraphJson(url, init = {}) {
	const response = await fetch(url, {
		...init,
		headers: {
			Authorization: `Bearer ${await getGraphAccessToken()}`,
			...init.headers
		}
	});
	const result = await response.json();

	if (!response.ok) {
		const error = new Error(result.error?.message || 'Microsoft Graph request failed.');
		error.statusCode = 502;
		throw error;
	}

	return result;
}

function mapDirectoryUsers(users) {
	return users
		.filter((user) => typeof user.id === 'string' && user.id)
		.map((user) => ({
			id: user.id,
			name: user.displayName || user.userPrincipalName || user.id,
			username: user.userPrincipalName || null
		}));
}

function matchesSearchText(user, searchText) {
	if (!searchText) {
		return true;
	}

	const normalizedSearchText = searchText.toLowerCase();
	return (user.displayName || '').toLowerCase().includes(normalizedSearchText)
		|| (user.userPrincipalName || '').toLowerCase().includes(normalizedSearchText)
		|| (user.id || '').toLowerCase().includes(normalizedSearchText);
}

async function listGroupDirectoryUsers(groupId, searchText, limit) {
	let nextUrl = new URL(
		`https://graph.microsoft.com/v1.0/groups/${groupId}/transitiveMembers/microsoft.graph.user`
	);
	nextUrl.searchParams.set('$select', 'id,displayName,userPrincipalName');
	nextUrl.searchParams.set('$top', String(Math.min(limit || maximumGraphUsers, maximumGraphPageSize)));

	const matchingUsers = [];
	let scannedUserCount = 0;

	while (nextUrl && matchingUsers.length < limit && scannedUserCount < maximumGraphScannedUsers) {
		const result = await fetchGraphJson(nextUrl);
		const returnedUsers = Array.isArray(result.value) ? result.value : [];
		scannedUserCount += returnedUsers.length;

		for (const user of returnedUsers) {
			if (!matchesSearchText(user, searchText)) {
				continue;
			}

			matchingUsers.push(user);
			if (matchingUsers.length >= limit) {
				break;
			}
		}

		nextUrl = result['@odata.nextLink'] ? new URL(result['@odata.nextLink']) : null;
	}

	return mapDirectoryUsers(matchingUsers);
}

async function searchDirectoryUsers(searchText, options = {}) {
	const groupId = options.groupId || null;
	const limit = options.limit || maximumGraphUsers;

	if (groupId) {
		return listGroupDirectoryUsers(groupId, searchText, limit);
	}

	const url = new URL('https://graph.microsoft.com/v1.0/users');
	url.searchParams.set('$select', 'id,displayName,userPrincipalName');
	url.searchParams.set('$top', String(limit));

	if (searchText) {
		const escapedSearchText = escapeODataString(searchText);
		url.searchParams.set(
			'$filter',
			`startswith(displayName,'${escapedSearchText}') or startswith(userPrincipalName,'${escapedSearchText}')`
		);
	} else {
		url.searchParams.set('$orderby', 'displayName');
	}

	const result = await fetchGraphJson(url);
	return mapDirectoryUsers(Array.isArray(result.value) ? result.value : []);
}

async function checkUserGroupMembership(userId, groupId) {
	const result = await fetchGraphJson(
		`https://graph.microsoft.com/v1.0/users/${userId}/checkMemberGroups`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ groupIds: [groupId] })
		}
	);

	return Array.isArray(result.value) && result.value.includes(groupId);
}

module.exports = {
	checkUserGroupMembership,
	isGraphDirectoryConfigured,
	searchDirectoryUsers
};
