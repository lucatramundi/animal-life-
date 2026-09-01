
const msalConfig = {
  auth: {
    clientId: "6e389510-6ca7-49ed-a62e-7de2fe71b7c2",
    authority: "https://login.microsoftonline.com/c9a7654a-5212-4510-94a0-57f7f18d33b6",
    redirectUri: window.location.origin,
  }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

async function SignIn() {
  await msalInstance.loginPopup({ scopes: ["User.Read"] });
  const account = msalInstance.getActiveAccount();
  console.log("Logged in user:", account);
}

function toggleWelcome() { 
    window.location.href = 'subpage.html';
}

