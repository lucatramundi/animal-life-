const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { authenticateRequest } = require("../lib/authenticate");

app.http('heartbeat', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const authenticatedUser = await authenticateRequest(request);
            const { avatar } = await request.json();
            const now = Date.now();

            if (!avatar) {
                return { status: 400, jsonBody: { error: "Missing avatar." } };
            }

            const tableClient = TableClient.fromConnectionString(
                process.env.StorageConnection,
                'OnlineUsers'
            );
            await tableClient.createTable();

            await tableClient.upsertEntity({
                partitionKey: "Presence",
                rowKey: authenticatedUser.id,
                DisplayName: authenticatedUser.name,
                AvatarUrl: avatar,
                LastSeen: now.toString()
            }, "Merge");

            const oneMinuteAgo = now - 60000;
            const activeUsers = [];

            const rows = tableClient.listEntities({
                queryOptions: { filter: `PartitionKey eq 'Presence'` }
            });

            for await (const user of rows) {
                const lastSeenTime = parseInt(user.LastSeen || 0);
                if (lastSeenTime > oneMinuteAgo && user.rowKey !== authenticatedUser.id) {
                    activeUsers.push({
                        id: user.rowKey,
                        name: user.DisplayName,
                        avatar: user.AvatarUrl
                    });
                }
            }

            return {
                status: 200,
                headers: { "Content-Type": "application/json" },
                jsonBody: activeUsers
            };
        } catch (err) {
            context.error('Heartbeat error:', err);
            return {
                status: err.statusCode || 500,
                jsonBody: { error: err.statusCode ? err.message : 'Internal server error.' }
            };
        }
    }
});