import API_BASE_URL from '../config/apiConfig';

const TOKEN_KEY = 'terra-api-token';

// TFE-101 — exchanges credentials for a JWT via terra-api's POST /api/auth/login,
// stores it, and throws on a non-2xx response (401 on bad credentials).
export async function login(username, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error("Login failed: " + response.statusText);
  }

  const data = await response.json();
  localStorage.setItem(TOKEN_KEY, data.access_token);
  return data;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated() {
    return !!getToken();
}

// TFE-101's "attach" half — wraps fetch so future authenticated calls (e.g. GET
// /api/v1/flags) don't each have to remember to set the Authorization header.
export async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

