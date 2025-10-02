// Central helper to determine which backend base URL to use.
export function getApiBase() {
  const fromEnv = (key) => {
    if (typeof process === 'undefined' || !process.env) {
      return '';
    }
    const value = process.env[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  let base =
    fromEnv('REACT_APP_API_URL') ||
    fromEnv('VITE_API_URL') ||
    fromEnv('APP_API_URL');

  if (typeof window !== 'undefined') {
    const runtimeCandidates = [
      base,
      window.__APP_API_URL__,
      window.APP_API_URL,
      window.VITE_API_URL,
      window.__RUNTIME_CONFIG__ && window.__RUNTIME_CONFIG__.API_URL,
      window.__RUNTIME_CONFIG__ && window.__RUNTIME_CONFIG__.apiUrl,
    ].filter((candidate) => typeof candidate === 'string' && candidate.trim());

    base = runtimeCandidates[0] || base;

    if (!base) {
      const { hostname, origin, protocol } = window.location || {};
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        base = 'http://localhost:5000';
      } else if (protocol?.startsWith('http') && origin) {
        base = origin;
      }
    }
  }

  return base ? base.replace(/\/+$/, '') : '';
}
