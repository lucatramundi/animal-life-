
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

function getSignedInAccount() {
  return msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0] || null;
}

function renderAuthState(account, message) {
  const loginButton = document.getElementById("login-btn");
  const profile = document.getElementById("user-profile");
  const userName = document.getElementById("user-name");
  const authMessage = document.getElementById("auth-message");
  const communityArea = document.getElementById("community-area");

  if (!loginButton || !profile || !userName || !authMessage || !communityArea) return;

  if (account) {
    userName.textContent = account.name || account.username;
    loginButton.hidden = true;
    profile.hidden = false;
    communityArea.hidden = false;
    authMessage.textContent = message || "You are signed in.";
    return;
  }

  loginButton.hidden = false;
  profile.hidden = true;
  communityArea.hidden = true;
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
      { headers: { "Authorization": `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      throw new Error(`Message loading failed (${response.status}).`);
    }

    const messages = await response.json();
    if (requestId !== chatRequestId || !selectedChatUser) return;

    const currentUserId = getSignedInAccount()?.localAccountId;
    const messageContainer = document.getElementById("chat-messages");
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
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({ recipientId, body: message })
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || `Message sending failed (${response.status}).`);
    }

    if (selectedChatUser?.id === recipientId) {
      addChatMessage(result.body, "outgoing");
      document.getElementById("chat-input").value = "";
    }
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
    sendHeartbeat();
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
    sendHeartbeat();
  } catch (error) {
    console.error("Sign-out failed:", error);
    renderAuthState(getSignedInAccount(), "Sign-out could not be completed.");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const account = getSignedInAccount();
  if (account) msalInstance.setActiveAccount(account);
  renderAuthState(account);

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