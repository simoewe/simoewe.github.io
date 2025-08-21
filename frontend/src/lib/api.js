const API = import.meta.env.VITE_API_URL || '';

async function handleJson(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export function analyzeText(text, { signal } = {}) {
  return fetch(`${API}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal
  }).then(handleJson);
}

export function analyzeFile(file, { signal } = {}) {
  const fd = new FormData();
  fd.append('file', file);
  return fetch(`${API}/analyze-file`, {
    method: 'POST',
    body: fd,
    signal
  }).then(handleJson);
}

export function ensureDataUrl(png) {
  if (!png) return null;
  return png.startsWith('data:image') ? png : `data:image/png;base64,${png}`;
}
