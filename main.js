
const msalConfig = {
  auth: {
    clientId: "6e389510-6ca7-49ed-a62e-7de2fe71b7c2",
    authority: "https://login.microsoftonline.com/c9a7654a-5212-4510-94a0-57f7f18d33b6",
    redirectUri: window.location.origin,
  }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

const apiScopes = [
  "api://6e389510-6ca7-49ed-a62e-7de2fe71b7c2/access_as_user"
];

let selectedChatUser = null;
let chatPollTimer = null;
let chatRequestId = 0;
let onlineUsers = [];
let recentConversations = [];
let knownUsers = [];
let directorySearchRequestId = 0;
let directorySearchTimer = null;

function getSignedInAccount() {
  return msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0] || null;
}

function getCurrentUserId() {
  const account = getSignedInAccount();
  const objectId = account?.idTokenClaims?.oid;
  if (typeof objectId === "string" && objectId) {
    return objectId;
  }

  return account?.localAccountId || null;
}

function getAccountDisplayName(account) {
  if (typeof account?.name === "string" && account.name.trim()) {
    return account.name.trim();
  }

  if (typeof account?.username === "string" && account.username.trim()) {
    return account.username.trim().split("@")[0];
  }

  return "player";
}

function renderAuthState(account, message) {
  const loginButton = document.getElementById("login-btn");
  const profile = document.getElementById("user-profile");
  const userName = document.getElementById("user-name");
  const authMessage = document.getElementById("auth-message");
  const communityArea = document.getElementById("community-area");

  if (!loginButton || !profile || !userName || !authMessage || !communityArea) return;

  if (account) {
    userName.textContent = getAccountDisplayName(account);
    loginButton.hidden = true;
    profile.hidden = false;
    communityArea.hidden = false;
    authMessage.textContent = message || "You are signed in.";
    return;
  }

  loginButton.hidden = false;
  profile.hidden = true;
  communityArea.hidden = true;
  onlineUsers = [];
  recentConversations = [];
  knownUsers = [];
  renderUserDirectory();
  clearChat();
  authMessage.textContent = message || "Please sign in to continue.";
}

async function selectChatUser(id, name) {
  clearChat();
  selectedChatUser = { id, name };
  document.getElementById("chat-heading").textContent = `Chat with ${name}`;
  document.getElementById("chat-input").disabled = false;
  document.querySelector(".send-button").disabled = false;
  document.querySelectorAll(".user-badge").forEach((userButton) => {
    userButton.classList.toggle("selected", userButton.dataset.userId === id);
  });

  const requestId = chatRequestId;
  await loadChatMessages(requestId);
  if (selectedChatUser?.id !== id || requestId !== chatRequestId) return;

  chatPollTimer = setInterval(() => loadChatMessages(requestId), 5000);
}

function getFallbackAvatarUrl(userId) {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userId)}`;
}

function getUserDirectoryEntries() {
  const mergedUsers = new Map();

  knownUsers.forEach((user) => {
    mergedUsers.set(user.id, {
      id: user.id,
      name: user.name,
      username: user.username || "",
      avatar: getFallbackAvatarUrl(user.id),
      isOnline: false,
      isRecent: false,
      lastMessageAt: "",
      lastMessagePreview: ""
    });
  });

  recentConversations.forEach((conversation) => {
    const existingEntry = mergedUsers.get(conversation.id);
    mergedUsers.set(conversation.id, {
      id: conversation.id,
      name: conversation.name || existingEntry?.name || conversation.id,
      username: existingEntry?.username || "",
      avatar: existingEntry?.avatar || getFallbackAvatarUrl(conversation.id),
      isOnline: false,
      isRecent: true,
      lastMessageAt: conversation.lastMessageAt || "",
      lastMessagePreview: conversation.lastMessagePreview || ""
    });
  });

  onlineUsers.forEach((user) => {
    const existingEntry = mergedUsers.get(user.id);
    mergedUsers.set(user.id, {
      id: user.id,
      name: user.name || existingEntry?.name || user.id,
      username: existingEntry?.username || "",
      avatar: user.avatar || existingEntry?.avatar || getFallbackAvatarUrl(user.id),
      isOnline: true,
      isRecent: existingEntry?.isRecent || false,
      lastMessageAt: existingEntry?.lastMessageAt || "",
      lastMessagePreview: existingEntry?.lastMessagePreview || ""
    });
  });

  return Array.from(mergedUsers.values()).sort((first, second) => {
    if (first.isOnline !== second.isOnline) {
      return first.isOnline ? -1 : 1;
    }

    if (first.isRecent !== second.isRecent) {
      return first.isRecent ? -1 : 1;
    }

    if (first.lastMessageAt && second.lastMessageAt && first.lastMessageAt !== second.lastMessageAt) {
      return second.lastMessageAt.localeCompare(first.lastMessageAt);
    }

    return first.name.localeCompare(second.name);
  });
}

function renderUserDirectory() {
  const container = document.getElementById("online-users-list");
  if (!container) return;

  container.replaceChildren();
  const users = getUserDirectoryEntries();

  if (users.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "user-list-empty";
    emptyState.textContent = "No online players or recent conversations yet.";
    container.append(emptyState);
    return;
  }

  users.forEach((user) => {
    const userButton = document.createElement("button");
    const avatar = document.createElement("img");
    const textWrap = document.createElement("span");
    const name = document.createElement("span");
    const meta = document.createElement("span");

    userButton.type = "button";
    userButton.className = "user-badge";
    userButton.dataset.userId = user.id;
    userButton.dataset.userName = user.name;
    userButton.addEventListener("click", () => selectChatUser(user.id, user.name));
    userButton.classList.toggle("selected", selectedChatUser?.id === user.id);

    avatar.src = user.avatar;
    avatar.width = 40;
    avatar.height = 40;
    avatar.alt = "";

    textWrap.className = "user-copy";
    name.className = "user-name";
    name.textContent = user.name;
    meta.className = "user-meta";
    meta.textContent = user.isOnline
      ? "Online now"
      : (user.lastMessagePreview
        ? `Offline - ${user.lastMessagePreview}`
        : (user.username || "Directory user"));

    textWrap.append(name, meta);
    userButton.append(avatar, textWrap);
    container.append(userButton);
  });
}

function setOnlineUsers(users) {
  onlineUsers = Array.isArray(users) ? users : [];
  renderUserDirectory();
}

async function loadRecentConversations() {
  const account = getSignedInAccount();
  if (!account) {
    recentConversations = [];
    renderUserDirectory();
    return;
  }

  try {
    const accessToken = await getApiAccessToken();
    const response = await fetch("/api/conversations", {
      headers: { "X-ZPlay-Authorization": `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Conversation loading failed (${response.status}).`);
    }

    recentConversations = await response.json();
    renderUserDirectory();
  } catch (error) {
    console.error("Failed to load recent conversations:", error);
  }
}

async function loadDirectoryUsers(searchText = "") {
  const account = getSignedInAccount();
  if (!account) {
    knownUsers = [];
    renderUserDirectory();
    return;
  }

  const requestId = ++directorySearchRequestId;

  try {
    const accessToken = await getApiAccessToken();
    const url = searchText
      ? `/api/users?search=${encodeURIComponent(searchText)}`
      : "/api/users";
    const response = await fetch(url, {
      headers: { "X-ZPlay-Authorization": `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`User directory loading failed (${response.status}).`);
    }

    const result = await response.json();
    if (requestId !== directorySearchRequestId) return;
    knownUsers = Array.isArray(result.users) ? result.users : [];
    renderUserDirectory();
  } catch (error) {
    console.error("Failed to load directory users:", error);
  }
}

function scheduleDirectorySearch() {
  const input = document.getElementById("user-search-input");
  const searchText = input?.value.trim() || "";

  if (directorySearchTimer) {
    clearTimeout(directorySearchTimer);
  }

  directorySearchTimer = setTimeout(() => {
    loadDirectoryUsers(searchText);
  }, 250);
}

function addChatMessage(message, type) {
  const messages = document.getElementById("chat-messages");
  if (!messages) return;

  const messageElement = document.createElement("p");
  messageElement.className = `chat-message ${type}`;
  messageElement.textContent = message;
  messages.append(messageElement);
  messages.scrollTop = messages.scrollHeight;
}

function clearChat() {
  chatRequestId += 1;
  if (chatPollTimer) {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }
  selectedChatUser = null;
  const messages = document.getElementById("chat-messages");
  const chatHeading = document.getElementById("chat-heading");
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.querySelector(".send-button");
  if (messages) messages.replaceChildren();
  if (chatHeading) chatHeading.textContent = "Select someone to chat";
  if (chatInput) {
    chatInput.value = "";
    chatInput.disabled = true;
  }
  if (sendButton) sendButton.disabled = true;
}

async function loadChatMessages(requestId) {
  if (!selectedChatUser) return;

  try {
    const accessToken = await getApiAccessToken();
    const response = await fetch(
      `/api/messages?userId=${encodeURIComponent(selectedChatUser.id)}`,
      { headers: { "X-ZPlay-Authorization": `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Message loading failed (${response.status}).`);
    }

    const messages = await response.json();
    if (requestId !== chatRequestId || !selectedChatUser) return;

    const currentUserId = getCurrentUserId();
    const messageContainer = document.getElementById("chat-messages");
    if (!messageContainer) return;
    messageContainer.replaceChildren();
    messages.forEach((message) => {
      const type = message.senderId === currentUserId ? "outgoing" : "incoming";
      addChatMessage(message.body, type);
    });
  } catch (error) {
    if (requestId === chatRequestId) {
      console.error("Failed to load conversation:", error);
      addChatMessage("Unable to load this conversation.", "system");
    }
  }
}

async function sendChatMessage(message) {
  if (!selectedChatUser) return;

  const recipientId = selectedChatUser.id;
  const sendButton = document.querySelector(".send-button");
  sendButton.disabled = true;

  try {
    const accessToken = await getApiAccessToken();
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ZPlay-Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        recipientId,
        recipientName: selectedChatUser.name,
        body: message
      })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `Message sending failed (${response.status}).`);
    }

    if (selectedChatUser?.id === recipientId) {
      addChatMessage(result.body, "outgoing");
      document.getElementById("chat-input").value = "";
    }

    await loadRecentConversations();
  } catch (error) {
    console.error("Failed to send message:", error);
    addChatMessage("Your message could not be sent.", "system");
  } finally {
    if (selectedChatUser?.id === recipientId) sendButton.disabled = false;
  }
}

async function signIn() {
  try {
    const result = await msalInstance.loginPopup({ scopes: apiScopes });
    msalInstance.setActiveAccount(result.account);
    renderAuthState(result.account, "You are signed in.");
    await Promise.all([loadDirectoryUsers(), loadRecentConversations(), sendHeartbeat()]);
  } catch (error) {
    console.error("Sign-in failed:", error);
    renderAuthState(null, "Sign-in was cancelled or could not be completed.");
  }
}

function toggleWelcome() { 
    window.location.href = 'subpage.html';
}

async function signOut() {
  try {
    await msalInstance.logoutPopup({ account: getSignedInAccount() });
    renderAuthState(null, "Goodbye. You have been signed out.");
  } catch (error) {
    console.error("Sign-out failed:", error);
    renderAuthState(getSignedInAccount(), "Sign-out could not be completed.");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const account = getSignedInAccount();
  if (account) msalInstance.setActiveAccount(account);
  renderAuthState(account);
  if (account) {
    loadDirectoryUsers();
    loadRecentConversations();
  }

  document.getElementById("user-search-input")?.addEventListener("input", () => {
    scheduleDirectorySearch();
  });

  document.getElementById("chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const chatInput = document.getElementById("chat-input");
    const message = chatInput.value.trim();
    if (!selectedChatUser || !message) return;

    await sendChatMessage(message);
  });
});

async function getApiAccessToken() {
  const account = getSignedInAccount();

  if (!account) {
    throw new Error("The user must be signed in.");
  }

  try {
    const result = await msalInstance.acquireTokenSilent({
      account,
      scopes: apiScopes
    });

    return result.accessToken;
  } catch (error) {
    const result = await msalInstance.acquireTokenPopup({
      account,
      scopes: apiScopes
    });

    return result.accessToken;
  }
}
