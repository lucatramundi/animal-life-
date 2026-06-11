const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

// 2. Register the HTTP Trigger function
app.http('heartbeat', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const { name, avatar } = await request.json();
            const now = Date.now();

            if (!name || !avatar) {
                return { status: 400, jsonBody: { error: "Missing visitor info." } };
            }

            const tableClient = TableClient.fromConnectionString(
                process.env.StorageConnection,
                'OnlineUsers'
            );
            await tableClient.createTable();

            // 3. Upsert the current user
            await tableClient.upsertEntity({
                partitionKey: "Presence",
                rowKey: name,
                AvatarUrl: avatar,
                LastSeen: now.toString()
            }, "Merge");

            // 4. Query and filter active users from the last 30 seconds
            const thirtySecondsAgo = now - 30000;
            const activeUsers = [];

            const rows = tableClient.listEntities({
                queryOptions: { filter: `PartitionKey eq 'Presence'` }
            });

            for await (const user of rows) {
                const lastSeenTime = parseInt(user.LastSeen || 0);
                if (lastSeenTime > thirtySecondsAgo) {
                    activeUsers.push({
                        name: user.rowKey,
                        avatar: user.AvatarUrl
                    });
                }
            }

            // 5. Return the clean list
            return {
                status: 200,
                headers: { "Content-Type": "application/json" },
                jsonBody: activeUsers
            };
        } catch (err) {
            context.log.error('Heartbeat error:', err);
            return { status: 500, jsonBody: { error: 'Internal server error.' } };
        }
    }
});