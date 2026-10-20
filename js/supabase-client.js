// KADINAMA IRU - Supabase Client

(function () {
  "use strict";

  const config = window.APP_CONFIG;

  if (!config) {
    console.error(
      "KADINAMA IRU: Configuration not found. Load js/config.js first."
    );
    return;
  }

  if (!config.SUPABASE_URL || !config.SUPABASE_PUBLISHABLE_KEY) {
    console.error(
      "KADINAMA IRU: Supabase URL or publishable key is missing."
    );
    return;
  }

  if (
    config.SUPABASE_PUBLISHABLE_KEY ===
    "PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE"
  ) {
    console.error(
      "KADINAMA IRU: Add your Supabase publishable key in js/config.js."
    );
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error(
      "KADINAMA IRU: Supabase library not loaded. Add the Supabase CDN script before this file."
    );
    return;
  }

  // Prevent accidental duplicate initialization.
  if (window.supabaseClient) {
    return;
  }

  try {
    window.supabaseClient = window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    console.info("KADINAMA IRU: Supabase client initialized.");
  } catch (error) {
    console.error(
      "KADINAMA IRU: Failed to initialize Supabase.",
      error
    );
  }
})();
