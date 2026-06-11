// Game State
const gameState = {
    playerName: '',
    townName: '',
    hairStyle: 'straight',
    hairColor: '#8B4513',
    skinTone: '#FDBCB4',
    noseStyle: 'round'
};

// Screen Management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

// Welcome Screen
function startGame() {
    showScreen('nameScreen');
    document.getElementById('playerName').focus();
}

// Name Input
function submitName() {
    const name = document.getElementById('playerName').value.trim();
    if (name.length === 0) {
        alert('Please enter a name!');
        return;
    }
    gameState.playerName = name;
    
    // Show town screen
    const nameGreeting = document.getElementById('nameGreeting');
    nameGreeting.textContent = `${name}, that's a great name!`;
    showScreen('townScreen');
    document.getElementById('townName').focus();
}

// Town Name Input
function submitTown() {
    const town = document.getElementById('townName').value.trim();
    if (town.length === 0) {
        alert('Please enter a town name!');
        return;
    }
    gameState.townName = town;
    
    // Show customization screen
    const townGreeting = document.getElementById('townGreeting');
    townGreeting.textContent = `Great! ${town} is even greater!`;
    showScreen('customizationScreen');
    
    // Initialize preview
    updateCharacterPreview();
}

// Character Customization
function setHairStyle(style) {
    gameState.hairStyle = style;
    document.querySelectorAll('[data-style]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-style="${style}"]`).classList.add('active');
    updateCharacterPreview();
}

function setHairColor(color) {
    // update state
    gameState.hairColor = color;

    // Update active state on all color buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
        const dataColor = btn.getAttribute('data-color') || (btn.dataset && btn.dataset.color) || '';
        if (dataColor) {
            btn.classList.toggle('active', dataColor.toLowerCase() === color.toLowerCase());
            return;
        }
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes('setHairColor')) {
            btn.classList.toggle('active', onclick.indexOf(color) !== -1);
            return;
        }
        btn.classList.remove('active');
    });

    // Immediately update both SVG previews: apply fill directly to the inner path (if present)
    ['characterSVG', 'characterLargeSVG'].forEach(svgId => {
        const hairEl = document.querySelector(`#${svgId} #hair`);
        if (!hairEl) return;

        // The visible color is usually on the <path> inside the group; prefer updating that element.
        const inner = hairEl.querySelector('path, circle, rect, polygon');
        if (inner) {
            inner.setAttribute('fill', color);
        } else {
            // If there's no inner shape, set the group's fill as a fallback
            hairEl.setAttribute('fill', color);
        }

        // Ensure the shape matches the current hairstyle
        try {
            updateHairStyle(hairEl);
            // If updateHairStyle created/updated a <path>, ensure it has the correct fill
            const after = hairEl.querySelector('path');
            if (after) after.setAttribute('fill', color);
        } catch (e) {
            // ignore
        }
    });

    // Refresh the rest of the character preview to keep everything in sync
    updateCharacterPreview();
}

function setSkinTone(tone) {
    gameState.skinTone = tone;
    
    const skinToneGroup = document.querySelectorAll('.option-group')[2]; // Skin Tone is the third option group
    skinToneGroup.querySelectorAll('.color-btn').forEach(btn => {
        if (btn.getAttribute('onclick').includes(tone)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    updateCharacterPreview();
}

function setNose(nose) {
    gameState.noseStyle = nose;
    document.querySelectorAll('[data-nose]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-nose="${nose}"]`).classList.add('active');
    updateCharacterPreview();
}

// Update Character Preview
function updateCharacterPreview() {
    updateCharacterSVG('characterSVG');
}

function updateCharacterSVG(svgId) {
    // Update head color
    const head = document.querySelector(`#${svgId} #head`);
    if (head) head.setAttribute('fill', gameState.skinTone);
    
    // Update hair: set fill on inner path if present, then update style
    const hair = document.querySelector(`#${svgId} #hair`);
    if (hair) {
        const inner = hair.querySelector('path, circle, rect, polygon');
        if (inner) {
            inner.setAttribute('fill', gameState.hairColor);
        } else {
            hair.setAttribute('fill', gameState.hairColor);
        }
        updateHairStyle(hair);
        // After style change ensure the path has the correct fill
        const updated = hair.querySelector('path');
        if (updated) updated.setAttribute('fill', gameState.hairColor);
    }
    
    // Update arms color
    const arms = document.querySelectorAll(`#${svgId} rect[x="40"], #${svgId} rect[x="130"]`);
    arms.forEach(arm => {
        arm.setAttribute('fill', gameState.skinTone);
    });
    
    // Update nose
    updateNose(svgId);
}

function updateHairStyle(hairElement) {
    const styles = {
        straight: 'M 60 50 Q 100 20 140 50 Q 120 40 100 40 Q 80 40 60 50',
        curly: 'M 60 55 Q 65 25 75 30 Q 85 20 100 20 Q 115 20 125 30 Q 135 25 140 55',
        wavy: 'M 60 50 Q 70 30 80 45 Q 90 25 100 40 Q 110 25 120 45 Q 130 30 140 50',
        spiky: 'M 60 50 L 70 15 L 80 35 L 90 10 L 100 35 L 110 10 L 120 35 L 130 15 L 140 50'
    };
    
    // Ensure there's a path inside the group to update the 'd' attribute.
    let path = hairElement.querySelector('path');
    if (!path) {
        // create a path if none exists
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hairElement.appendChild(path);
    }
    
    path.setAttribute('d', styles[gameState.hairStyle]);
    // Keep the fill in sync in case callers set the group's fill
    if (gameState.hairColor) path.setAttribute('fill', gameState.hairColor);
}

function updateNose(svgId) {
    const nose = document.querySelector(`#${svgId} #nose`);
    if (!nose) return;
    
    const noseShapes = {
        round: { type: 'circle', attrs: { cx: '100', cy: '85', r: '6' } },
        triangle: { type: 'polygon', attrs: { points: '100,80 105,90 95,90' } },
        square: { type: 'rect', attrs: { x: '94', y: '79', width: '12', height: '12', rx: '2' } },
        heart: { type: 'path', attrs: { d: 'M 100 90 Q 95 85 92 85 Q 90 85 90 87 Q 90 90 100 95 Q 110 90 110 87 Q 110 85 108 85 Q 105 85 100 90' } }
    };
    
    const shape = noseShapes[gameState.noseStyle];
    const parent = nose.parentElement;
    const index = Array.from(parent.children).indexOf(nose);
    
    const newNose = document.createElementNS('http://www.w3.org/2000/svg', shape.type);
    newNose.setAttribute('id', 'nose');
    newNose.setAttribute('fill', '#333');
    
    Object.entries(shape.attrs).forEach(([key, value]) => {
        newNose.setAttribute(key, value);
    });
    
    parent.replaceChild(newNose, nose);
}

// Finish Customization
function finishCustomization() {
    // Copy character to large SVG
    updateCharacterSVG('characterLargeSVG');
    
    // Show game start screen
    const finalDialogue = document.getElementById('finalDialogue');
    finalDialogue.textContent = `Wow, ${gameState.playerName}! You look amazing! Welcome to ${gameState.townName}! Let's have an adventure together!`;
    
    showScreen('gameStartScreen');
}

// Enter Game
function enterGame() {
    const gameTitle = document.getElementById('gameTitle');
    gameTitle.textContent = `Welcome to ${gameState.townName}, ${gameState.playerName}!`;
    
    const playerStats = document.getElementById('playerStats');
    playerStats.textContent = `Your character is ready for adventure!`;
    
    showScreen('gameScreen');
    startMainGame();
}

// Main Game Logic
function startMainGame() {
    const gameContent = document.getElementById('gameContent');
    gameContent.innerHTML = `
        <div style="font-size: 60px; margin: 20px 0;">🐕</div>
        <p>Woofy is jumping with joy to meet you!</p>
        <p style="margin-top: 20px; font-size: 18px; color: #666;">Your adventure in ${gameState.townName} is just beginning...</p>
        <p style="margin-top: 30px; font-size: 16px; color: #999;">More features coming soon! ✨</p>
    `;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    showScreen('welcomeScreen');
});

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

function toggleWelcome() { 
    window.location.href = 'subpage.html';
}