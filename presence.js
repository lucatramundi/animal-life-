async function sendHeartbeat() {
    const account = getSignedInAccount();
    if (!account) return;

    // Generate the avatar URL for the user's presence icon
    const iconUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(account.localAccountId)}`;

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
        updateOnlineUsersUI(onlineUsers);
    } catch (err) {
        console.error("Failed to fetch online presence:", err);
    }
}

function updateOnlineUsersUI(users) {
    const container = document.getElementById('online-users-list');
    if (!container) return;
    container.replaceChildren();

    users.forEach(user => {
        const userButton = document.createElement('button');
        const avatar = document.createElement('img');
        const name = document.createElement('span');

        userButton.type = 'button';
        userButton.className = 'user-badge';
        userButton.dataset.userId = user.id;
        userButton.dataset.userName = user.name;
        userButton.addEventListener('click', () => selectChatUser(user.id, user.name));
        avatar.src = user.avatar;
        avatar.width = 40;
        avatar.height = 40;
        avatar.alt = '';
        name.textContent = user.name;
        userButton.append(avatar, name);
        container.append(userButton);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    sendHeartbeat();
    setInterval(sendHeartbeat, 10000);
});
