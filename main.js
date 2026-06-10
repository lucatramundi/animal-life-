async function sendHeartbeat() {
    const visitorName = getOrCreateVisitorName();
    const iconUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(visitorName)}`;

    try {
        // Fetch out to SWA's built-in managed API route
        const response = await fetch('/api/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: visitorName, avatar: iconUrl })
        });

        const onlineUsers = await response.json();
        updateOnlineUsersUI(onlineUsers);
    } catch (err) {
        console.error("Failed to fetch online presence:", err);
    }
}

function updateOnlineUsersUI(users) {
        
    const container = document.getElementById('online-users-list');
    container.innerHTML = ''; // Clear out the list

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

function getOrCreateVisitorName() {
    let name = localStorage.getItem('assigned_visitor_name');
    if (!name) {
        name = 'visitor-' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('assigned_visitor_name', name);
    }
    return name;
}

// Check-in immediately on load, then pulse every 10 seconds
window.addEventListener('DOMContentLoaded', () => {
    getOrCreateVisitorName(); // ensure name exists before first heartbeat
    sendHeartbeat();
    setInterval(sendHeartbeat, 10000);
});