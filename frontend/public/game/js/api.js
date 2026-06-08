const TOKEN_KEY = 'token';
const STRIPE_MODE_KEY = 'stripe_mode';

export function getApiBase() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return '';
  }

  if (window.JOYMED_API_URL) {
    return String(window.JOYMED_API_URL).replace(/\/$/, '');
  }

  const fromQuery = new URLSearchParams(window.location.search).get('apiBase');
  if (fromQuery) {
    return fromQuery.replace(/\/$/, '');
  }

  // Same-origin proxy (vercel.json rewrites /api → Render)
  return window.location.origin;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const stripeMode = localStorage.getItem(STRIPE_MODE_KEY) || 'test';
  headers['X-Stripe-Mode'] = stripeMode;
  return headers;
}

const API_RETRY_ATTEMPTS = 3;
const API_RETRY_DELAY_MS = 400;

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < API_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (attempt < API_RETRY_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, API_RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
}

function apiConnectionError() {
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  if (isLocal) {
    return 'Cannot connect to server. Run: cd backend && npm start';
  }
  return 'Cannot reach the server. The API may be waking up — wait and try again.';
}

export async function apiPost(path, body) {
  let res;
  try {
    res = await fetchWithRetry(`${getApiBase()}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(apiConnectionError());
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function apiGet(path) {
  let res;
  try {
    res = await fetchWithRetry(`${getApiBase()}${path}`, {
      headers: authHeaders(),
    });
  } catch {
    throw new Error(apiConnectionError());
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function navigateTo(path) {
  const top = window.top || window;
  top.location.href = path;
}

export function mapProfile(profile) {
  return {
    username: profile.displayName?.split('@')[0] || profile.displayName || 'Player',
    displayName: profile.displayName,
    highScore: profile.highScore,
    maxLayer: profile.maxLayer,
    energy: profile.energy,
    isVip: profile.isVip,
    goldBalance: profile.goldBalance ?? 0,
  };
}
