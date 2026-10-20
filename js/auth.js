// KADINAMA IRU - Authentication Helpers

(function () {
  "use strict";

  function getClient() {
    if (!window.supabaseClient) {
      console.error("Supabase client is not initialized.");
      return null;
    }

    return window.supabaseClient;
  }

  // Get the currently signed-in user.
  async function getCurrentUser() {
    const client = getClient();

    if (!client) return null;

    const { data, error } = await client.auth.getUser();

    if (error) {
      console.error("Unable to get current user:", error.message);
      return null;
    }

    return data.user || null;
  }

  // Get the current session.
  async function getCurrentSession() {
    const client = getClient();

    if (!client) return null;

    const { data, error } = await client.auth.getSession();

    if (error) {
      console.error("Unable to get session:", error.message);
      return null;
    }

    return data.session || null;
  }

  // Redirect users who are not signed in.
  async function requireAuth(redirectTo = "login.html") {
    const user = await getCurrentUser();

    if (!user) {
      window.location.replace(redirectTo);
      return null;
    }

    return user;
  }

  // Redirect signed-in users away from authentication pages.
  async function redirectIfAuthenticated(
    redirectTo = "dashboard.html"
  ) {
    const session = await getCurrentSession();

    if (session) {
      window.location.replace(redirectTo);
      return true;
    }

    return false;
  }

  // Sign out the current user.
  async function logout() {
    const client = getClient();

    if (!client) {
      return {
        success: false,
        error: "Authentication is not available."
      };
    }

    const { error } = await client.auth.signOut();

    if (error) {
      console.error("Logout failed:", error.message);

      return {
        success: false,
        error: error.message
      };
    }

    window.location.replace("login.html");

    return {
      success: true,
      error: null
    };
  }

  // Listen for authentication state changes.
  function onAuthStateChange(callback) {
    const client = getClient();

    if (!client) return null;

    const { data } = client.auth.onAuthStateChange(
      (event, session) => {
        if (typeof callback === "function") {
          callback(event, session);
        }
      }
    );

    return data.subscription;
  }

  // Make helpers available to other JavaScript files.
  window.KadinamaAuth = Object.freeze({
    getCurrentUser,
    getCurrentSession,
    requireAuth,
    redirectIfAuthenticated,
    logout,
    onAuthStateChange
  });
})();
