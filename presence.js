function getOrCreateVisitorName() {
    let name = localStorage.getItem('assigned_visitor_name');
    if (!name) {
        name = 'vis-' + Math.random().toString(36).slice(2, 4);
        localStorage.setItem('assigned_visitor_name', name);
    }
    return name;
}

async function sendHeartbeat() {
    const visitorName = getOrCreateVisitorName();
    const iconUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(visitorName)}`;

    try {
        const response = await fetch('/api/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: visitorName, avatar: iconUrl })
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
        userButton.dataset.userName = user.name;
        userButton.addEventListener('click', () => selectChatUser(user.name));
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
    getOrCreateVisitorName();
    sendHeartbeat();
    setInterval(sendHeartbeat, 10000);
});
