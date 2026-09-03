const {
	checkUserGroupMembership,
	isGraphDirectoryConfigured
} = require('./graphDirectory');

const membershipCacheDurationMs = 5 * 60 * 1000;
const membershipCache = new Map();

function getAllowedGroupId() {
	const groupId = process.env.ENTRA_ALLOWED_GROUP_ID;
	return typeof groupId === 'string' && groupId.trim()
		? groupId.trim()
		: null;
}

function getCachedMembership(userId) {
	const cachedEntry = membershipCache.get(userId);
	if (!cachedEntry || cachedEntry.expiresAt <= Date.now()) {
		membershipCache.delete(userId);
		return null;
	}

	return cachedEntry.isMember;
}

function setCachedMembership(userId, isMember) {
	membershipCache.set(userId, {
		isMember,
		expiresAt: Date.now() + membershipCacheDurationMs
	});
}

function getTokenGroupMembership(payload, groupId) {
	if (Array.isArray(payload?.groups)) {
		return payload.groups.includes(groupId);
	}

	return null;
}

async function isUserInAllowedGroup(userId, payload) {
	const allowedGroupId = getAllowedGroupId();
	if (!allowedGroupId) {
		return true;
	}

	const tokenMembership = getTokenGroupMembership(payload, allowedGroupId);
	if (typeof tokenMembership === 'boolean') {
		return tokenMembership;
	}

	const cachedMembership = getCachedMembership(userId);
	if (typeof cachedMembership === 'boolean') {
		return cachedMembership;
	}

	if (!isGraphDirectoryConfigured()) {
		const error = new Error(
			'ENTRA_ALLOWED_GROUP_ID requires Microsoft Graph credentials to verify group membership.'
		);
		error.statusCode = 503;
		throw error;
	}

	const isMember = await checkUserGroupMembership(userId, allowedGroupId);
	setCachedMembership(userId, isMember);
	return isMember;
}

async function requireAllowedUser(userId, payload, failureMessage) {
	const isMember = await isUserInAllowedGroup(userId, payload);
	if (isMember) {
		return;
	}

	const error = new Error(
		failureMessage || 'Your account is not a member of the required Entra group.'
	);
	error.statusCode = 403;
	throw error;
}

async function filterUsersByAllowedGroup(users) {
	const allowedGroupId = getAllowedGroupId();
	if (!allowedGroupId) {
		return users;
	}

	const results = await Promise.all(users.map(async (user) => ({
		user,
		isAllowed: await isUserInAllowedGroup(user.id)
	})));

	return results
		.filter((result) => result.isAllowed)
		.map((result) => result.user);
}

module.exports = {
	filterUsersByAllowedGroup,
	getAllowedGroupId,
	requireAllowedUser
};
