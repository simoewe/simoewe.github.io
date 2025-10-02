// Runtime configuration for the frontend.
// Adjust the URL to match the deployed backend or override it by
// defining window.__APP_API_URL__ before this script runs.
(function configureApiBase(global) {
  if (typeof global !== 'undefined' && !global.__APP_API_URL__) {
    global.__APP_API_URL__ = 'https://simoewe-github-io-z78f.onrender.com';
  }
})(typeof window !== 'undefined' ? window : undefined);
