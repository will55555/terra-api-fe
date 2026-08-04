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
    throw new Error("Login failed: Invalid username or password");
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

// terra-api-adr-012 — reads the JWT's claims for ROUTING decisions only.
//
// ⚠️ This is NOT a security boundary and must never be treated as one. A JWT payload is
// base64, not encrypted: anyone can decode it, and anyone can hand-craft one in localStorage.
// The signature is what makes a token trustworthy, and only the server can verify it.
//
// ADR-012 is explicit that gating a React route controls RENDERING, not ACCESS — a customer
// can read the shipped bundle and call /api/v1/internal/* directly. Every operator endpoint
// enforces role=internal AND ops:read server-side (OperatorAccess), which is the real gate.
// This exists so an operator lands on the right page, not to keep anyone out.
//
// Deliberately no jwt-decode dependency: this is ~10 lines of base64 and adding a package to
// avoid them is not worth the supply-chain surface.
export function getTokenClaims() {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    // JWT uses base64url (- and _ instead of + and /), which atob does not accept.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    // A malformed token is not an error worth surfacing — it just means no claims, and the
    // server will reject the token on the next call anyway.
    return null;
  }
}

/** True if the token claims the internal audience. Routing only — see getTokenClaims. */
export function isOperator() {
  return getTokenClaims()?.role === 'internal';
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

