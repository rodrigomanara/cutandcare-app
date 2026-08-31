// Authentication & session management for the SugarCRM booking webapp.
//
// Responsibilities:
//  - exchange username/password for an OAuth2 token (password grant)
//  - persist the token in sessionStorage (survives reloads, not tab close)
//  - proactively refresh the access token ~5 min before it expires
//  - fall back to a full re-login when the refresh token is dead
//
// HttpOnly cookie storage is not possible here because the browser talks to
// SugarCRM directly with no backend of our own to set cookies. sessionStorage
// keeps the token out of persistent disk storage and scoped to the tab.

import { config, apiUrl } from './config.js';

const STORAGE_KEY = 'ccb.session';

let refreshTimer = null;
let refreshInFlight = null;
let sessionLostHandler = () => {
  window.location.replace('login.html?expired=1');
};

export class AuthError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

// --- session storage -------------------------------------------------------

export function getSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

// True when we hold a refresh token that has not itself expired — i.e. the
// session can be kept alive without asking the user to type a password.
export function isAuthenticated() {
  const s = getSession();
  return Boolean(s && s.refreshToken && s.refreshExpiresAt > Date.now());
}

export function getAccessToken() {
  return getSession()?.accessToken ?? null;
}

function storeTokenResponse(data) {
  const now = Date.now();
  const session = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: now + (Number(data.expires_in) || 3600) * 1000,
    refreshExpiresAt: now + (Number(data.refresh_expires_in) || 1209600) * 1000,
    obtainedAt: now,
  };
  writeSession(session);
  scheduleRefresh();
  return session;
}

// --- token endpoint ------------------------------------------------------

async function tokenRequest(body) {
  let res;
  try {
    res = await fetch(apiUrl('oauth2/token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError('Network error — could not reach SugarCRM.', { code: 'network' });
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty / non-JSON body */
  }

  if (!res.ok) {
    const message =
      data?.error_message ||
      humanizeError(data?.error) ||
      `Authentication failed (${res.status}).`;
    throw new AuthError(message, { code: data?.error, status: res.status });
  }
  return data;
}

function humanizeError(code) {
  switch (code) {
    case 'invalid_grant':
    case 'need_login':
      return 'Incorrect username or password.';
    case 'invalid_client':
      return 'This app is not authorised on the SugarCRM server.';
    default:
      return null;
  }
}

// --- public operations -------------------------------------------------

export async function login(username, password) {
  const data = await tokenRequest({
    grant_type: 'password',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    username,
    password,
    platform: config.platform,
  });
  return storeTokenResponse(data);
}

// Refresh the access token. Coalesces concurrent callers onto one request.
export function refresh() {
  if (refreshInFlight) return refreshInFlight;

  const s = getSession();
  if (!s || !s.refreshToken || s.refreshExpiresAt <= Date.now()) {
    return Promise.reject(
      new AuthError('Session expired. Please sign in again.', { code: 'refresh_expired' }),
    );
  }

  refreshInFlight = tokenRequest({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: s.refreshToken,
    platform: config.platform,
  })
    .then(storeTokenResponse)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

// Return a usable access token, refreshing first if it is expired or within
// the lead-time window. Throws AuthError if no live session exists.
export async function ensureValidToken() {
  const s = getSession();
  if (!s) throw new AuthError('Not authenticated.', { code: 'no_session' });

  if (Date.now() >= s.expiresAt - config.refreshLeadTimeMs) {
    await refresh();
  }
  return getAccessToken();
}

export async function logout() {
  const token = getAccessToken();
  if (token) {
    try {
      await fetch(apiUrl('oauth2/logout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'OAuth-Token': token },
      });
    } catch {
      /* best effort — clear locally regardless */
    }
  }
  clearSession();
}

// --- proactive refresh scheduling -------------------------------------

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);

  const s = getSession();
  if (!s) return;

  const delay = Math.max(0, s.expiresAt - Date.now() - config.refreshLeadTimeMs);
  refreshTimer = setTimeout(() => {
    refresh().catch(() => handleSessionLost());
  }, delay);
}

// Register what should happen when the session cannot be kept alive
// (refresh token expired or rejected). Default: redirect to the login page.
export function setSessionLostHandler(fn) {
  if (typeof fn === 'function') sessionLostHandler = fn;
}

export function handleSessionLost() {
  clearSession();
  sessionLostHandler();
}

// Wire up background refresh + recovery from timer throttling. Call once per
// page after confirming the user is authenticated.
export function initAuth() {
  scheduleRefresh();

  // Mobile browsers throttle timers in backgrounded tabs, so re-evaluate the
  // schedule (and refresh immediately if already overdue) whenever we return.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isAuthenticated()) scheduleRefresh();
  });
  window.addEventListener('online', () => {
    if (isAuthenticated()) scheduleRefresh();
  });
}
