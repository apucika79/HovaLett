// Runtime configuration.
// CI/CD may replace the __...__ placeholders; direct static/live preview falls back to the public dev Supabase config.
(function configureHovaLett() {
  const fallbackConfig = {
    APP_ENV: "dev",
    SUPABASE_URL: "https://eishxohixndoiltazdzu.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_5FlWmjnmAOU47zsUSwVLrg_5h2Kk9yT",
    MONITORING_ENDPOINT: "",
    ERROR_TRACKING_ENDPOINT: "",
    AUTH_SOCIAL_PROVIDERS: "google",
  };

  function buildValue(value, fallback) {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith("__") || trimmed.endsWith("__")) return fallback;
    return trimmed;
  }

  window.__HOVALETT_CONFIG__ = {
    APP_ENV: buildValue("__APP_ENV__", fallbackConfig.APP_ENV),
    SUPABASE_URL: buildValue("__SUPABASE_URL__", fallbackConfig.SUPABASE_URL),
    SUPABASE_PUBLISHABLE_KEY: buildValue("__SUPABASE_PUBLISHABLE_KEY__", fallbackConfig.SUPABASE_PUBLISHABLE_KEY),
    MONITORING_ENDPOINT: buildValue("__MONITORING_ENDPOINT__", fallbackConfig.MONITORING_ENDPOINT),
    ERROR_TRACKING_ENDPOINT: buildValue("__ERROR_TRACKING_ENDPOINT__", fallbackConfig.ERROR_TRACKING_ENDPOINT),
    AUTH_SOCIAL_PROVIDERS: buildValue("__AUTH_SOCIAL_PROVIDERS__", fallbackConfig.AUTH_SOCIAL_PROVIDERS),
  };
})();
