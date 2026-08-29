function toggleWelcome() { 
    window.location.href = 'subpage.html';
}

  // 1. Configuration
  const msalConfig = {
    auth: {
      clientId: "6e389510-6ca7-49ed-a62e-7de2fe71b7c2", // From Azure Portal App Registration
      authority: "https://login.microsoftonline.com/c9a7654a-5212-4510-94a0-57f7f18d33b6", // Or "common" for multi-tenant
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    }
  };

  // 2. Initialize PublicClientApplication
  const msalApp = new msal.PublicClientApplication(msalConfig);

  // 3. Handle Auth Redirect & Initial Page Load State
  window.addEventListener("DOMContentLoaded", async () => {
    try {
      const response = await msalApp.handleRedirectPromise();
      if (response) {
        msalApp.setActiveAccount(response.account);
      }
      updateUI();
    } catch (error) {
      console.error("Auth redirect handling error:", error);
    }
  });

  // 4. Update UI Based on Login State
  function updateUI() {
    const currentAccount = msalApp.getActiveAccount() || msalApp.getAllAccounts()[0];
    
    if (currentAccount) {
      msalApp.setActiveAccount(currentAccount);
      document.getElementById("login-btn").style.display = "none";
      document.getElementById("user-profile").style.display = "block";
      document.getElementById("user-name").innerText = currentAccount.name || currentAccount.username;
    } else {
      document.getElementById("login-btn").style.display = "inline-block";
      document.getElementById("user-profile").style.display = "none";
    }
  }

  // 5. Sign-in Handler (Popup or Redirect)
  async function signIn() {
    const loginRequest = { scopes: ["User.Read"] };
    try {
      const loginResponse = await msalApp.loginPopup(loginRequest);
      msalApp.setActiveAccount(loginResponse.account);
      updateUI();
    } catch (error) {
      console.error("Login failed:", error);
    }
  }

  // 6. Sign-out Handler
  function signOut() {
    const currentAccount = msalApp.getActiveAccount();
    const logoutRequest = { account: currentAccount };
    msalApp.logoutPopup(logoutRequest).then(() => {
      updateUI();
    }).catch(error => console.error(error));
  }

  // 7. Utility: Acquire Access Token for API Calls
  async function getAccessToken() {
    const account = msalApp.getActiveAccount();
    if (!account) throw new Error("No active account found.");

    const tokenRequest = {
      scopes: ["User.Read"],
      account: account
    };

    try {
      const response = await msalApp.acquireTokenSilent(tokenRequest);
      return response.accessToken;
    } catch (error) {
      if (error instanceof msal.InteractionRequiredAuthError) {
        const response = await msalApp.acquireTokenPopup(tokenRequest);
        return response.accessToken;
      }
      throw error;
    }
  }

