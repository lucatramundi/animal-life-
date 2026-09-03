let heartbeatRequestNumber = 0;

async function sendHeartbeat() {
    const account = getSignedInAccount();
    if (!account) return;
    const requestNumber = ++heartbeatRequestNumber;
    const identitySeed = getCurrentUserId() || account.username || account.localAccountId;

    // Generate the avatar URL for the user's presence icon
    const iconUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(identitySeed)}`;

    try {
        const accessToken = await getApiAccessToken();
        // Send the heartbeat request to the server with the user's avatar 
        // URL the server will record the user within the table storage
        // and return the list of online users
        const response = await fetch('/api/heartbeat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-ZPlay-Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ avatar: iconUrl })
        });

        if (!response.ok) {
            console.error("Heartbeat API error:", response.status);
            return;
        }

        const onlineUsers = await response.json();
        if (requestNumber !== heartbeatRequestNumber) return;
        setOnlineUsers(onlineUsers);
        await loadRecentConversations();
    } catch (err) {
        console.error("Failed to fetch online presence:", err);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    sendHeartbeat();
    setInterval(sendHeartbeat, 10000);
});
