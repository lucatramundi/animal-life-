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
    container.innerHTML = '';

    users.forEach(user => {
        const userMarkup = `
            <div class="user-badge">
                <img src="${user.avatar}" width="40" height="40" />
                <span>${user.name}</span>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', userMarkup);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    getOrCreateVisitorName();
    sendHeartbeat();
    setInterval(sendHeartbeat, 10000);
});
