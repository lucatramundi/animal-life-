
const msalConfig = {
  auth: {
    clientId: "6e389510-6ca7-49ed-a62e-7de2fe71b7c2",
    authority: "https://login.microsoftonline.com/c9a7654a-5212-4510-94a0-57f7f18d33b6",
    redirectUri: window.location.origin,
  }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

let selectedChatUser = null;

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

function selectChatUser(name) {
  selectedChatUser = name;
  document.getElementById("chat-heading").textContent = `Chat with ${name}`;
  document.getElementById("chat-input").disabled = false;
  document.querySelector(".send-button").disabled = false;
  document.querySelectorAll(".user-badge").forEach((userButton) => {
    userButton.classList.toggle("selected", userButton.dataset.userName === name);
  });
  clearChat();
  addChatMessage(`You can now send a message to ${name}.`, "system");
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

async function signIn() {
  try {
    const result = await msalInstance.loginPopup({ scopes: ["User.Read"] });
    msalInstance.setActiveAccount(result.account);
    renderAuthState(result.account, "You are signed in.");
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

  document.getElementById("chat-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const chatInput = document.getElementById("chat-input");
    const message = chatInput.value.trim();
    if (!selectedChatUser || !message) return;

    addChatMessage(message, "outgoing");
    chatInput.value = "";
  });
});