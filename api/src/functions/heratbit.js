const { app, input } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

// 1. Define the Table Storage Input Binding
const tableInput = input.table({
    tableName: 'OnlineUsers',
    partitionKey: 'Presence',
    connection: 'AzureWebJobsStorage'
});

// 2. Register the HTTP Trigger function
app.http('heartbeat', {
    methods: ['POST'],
    authLevel: 'anonymous',
    extraInputs: [tableInput],
    handler: async (request, context) => {
        const { name, avatar } = await request.json();
        const now = Date.now();

        if (!name || !avatar) {
            return { status: 400, body: "Missing visitor info." };
        }

        // 3. Upsert the current user (insert or replace if already exists)
        const tableClient = TableClient.fromConnectionString(
            process.env.AzureWebJobsStorage,
            'OnlineUsers'
        );
        await tableClient.upsertEntity({
            partitionKey: "Presence",
            rowKey: name,
            AvatarUrl: avatar,
            LastSeen: now.toString()
        }, "Merge");

        // 4. Retrieve and filter the input table rows
        const thirtySecondsAgo = now - 30000;
        const activeUsers = [];
        
        // Get rows read automatically by the input binding
        const rows = context.extraInputs.get(tableInput) || [];

        rows.forEach(user => {
            const lastSeenTime = parseInt(user.LastSeen || 0);
            if (lastSeenTime > thirtySecondsAgo) {
                activeUsers.push({
                    name: user.RowKey,
                    avatar: user.AvatarUrl
                });
            }
        });

        // 5. Return the clean list
        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            jsonBody: activeUsers
        };
    }
});