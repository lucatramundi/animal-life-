const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

const messagesTableName = 'Messages';
const presenceTableName = 'OnlineUsers';
const presencePartitionKey = 'Presence';
const defaultPresenceRetentionSeconds = 60;
const defaultMessageRetentionDays = 30;

function getStorageConnectionString() {
	return process.env.StorageConnection;
}

function parsePositiveIntegerSetting(settingName, fallbackValue) {
	const rawValue = process.env[settingName];

	if (!rawValue) {
		return fallbackValue;
	}

	const parsedValue = Number.parseInt(rawValue, 10);
	if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
		throw new Error(`${settingName} must be a positive integer.`);
	}

	return parsedValue;
}

async function deletePresenceRowsOlderThan(cutoffTimestamp) {
	const tableClient = TableClient.fromConnectionString(
		getStorageConnectionString(),
		presenceTableName
	);
	await tableClient.createTable();

	let deletedCount = 0;
	const rows = tableClient.listEntities({
		queryOptions: { filter: `PartitionKey eq '${presencePartitionKey}'` }
	});

	for await (const row of rows) {
		const lastSeen = Number.parseInt(row.LastSeen || '', 10);
		if (!Number.isInteger(lastSeen) || lastSeen >= cutoffTimestamp) {
			continue;
		}

		await tableClient.deleteEntity(row.partitionKey, row.rowKey);
		deletedCount += 1;
	}

	return deletedCount;
}

async function deleteMessagesOlderThan(cutoffIsoTimestamp) {
	const tableClient = TableClient.fromConnectionString(
		getStorageConnectionString(),
		messagesTableName
	);
	await tableClient.createTable();

	let deletedCount = 0;
	const rows = tableClient.listEntities();

	for await (const row of rows) {
		if (typeof row.CreatedAt !== 'string' || row.CreatedAt >= cutoffIsoTimestamp) {
			continue;
		}

		await tableClient.deleteEntity(row.partitionKey, row.rowKey);
		deletedCount += 1;
	}

	return deletedCount;
}

app.timer('cleanupStorage', {
	schedule: '%CLEANUP_SCHEDULE%',
	handler: async (_timer, context) => {
		const presenceRetentionSeconds = parsePositiveIntegerSetting(
			'PRESENCE_RETENTION_SECONDS',
			defaultPresenceRetentionSeconds
		);
		const messageRetentionDays = parsePositiveIntegerSetting(
			'MESSAGE_RETENTION_DAYS',
			defaultMessageRetentionDays
		);

		const now = Date.now();
		const stalePresenceCutoff = now - (presenceRetentionSeconds * 1000);
		const expiredMessageCutoff = new Date(
			now - (messageRetentionDays * 24 * 60 * 60 * 1000)
		).toISOString();

		const [deletedPresenceRows, deletedMessageRows] = await Promise.all([
			deletePresenceRowsOlderThan(stalePresenceCutoff),
			deleteMessagesOlderThan(expiredMessageCutoff)
		]);

		context.log(
			`Cleanup complete. Deleted ${deletedPresenceRows} presence rows and ${deletedMessageRows} expired messages.`
		);
	}
});
