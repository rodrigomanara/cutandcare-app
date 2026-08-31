// Thin REST client for SugarCRM.
//
// Every call goes through apiFetch(), which:
//  - attaches a valid OAuth-Token (refreshing it first if needed)
//  - retries transient failures (network / 429 / 5xx) with backoff, honouring
//    Retry-After for rate limits
//  - on 401, refreshes once and retries, then gives up to a full re-login
//  - normalises SugarCRM error payloads into ApiError
//  - reports activity + a call-log entry to activity.js

import { apiUrl, config } from './config.js';
import { ensureValidToken, refresh, handleSessionLost } from './auth.js';
import { activityStart, activityEnd, recordApiCall } from './activity.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (attempt) => Math.min(8000, 250 * 2 ** attempt) + Math.random() * 250;

export class ApiError extends Error {
  constructor(message, { code, status, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function log(...args) {
  if (config.debug) console.debug('[api]', ...args);
}

// Public entry — wraps _request with activity tracking + logging (once per
// logical call, not once per internal retry).
export async function apiFetch(path, options = {}) {
  const method = options.method || 'GET';
  const startedAt = performance.now();
  const meta = { retries: 0, status: 0 };

  activityStart();
  try {
    const data = await _request(path, options, meta);
    recordApiCall({ method, path, status: meta.status || 200, ms: ms(startedAt), retries: meta.retries });
    return data;
  } catch (err) {
    recordApiCall({
      method,
      path,
      status: err?.status ?? 0,
      ms: ms(startedAt),
      retries: meta.retries,
      error: err?.message || String(err),
    });
    throw err;
  } finally {
    activityEnd();
  }
}

function ms(from) {
  return Math.round(performance.now() - from);
}

async function _request(path, options, meta, _isRetryAfter401 = false) {
  const { method = 'GET', body, headers = {}, retry = true } = options;

  let token;
  try {
    token = await ensureValidToken();
  } catch {
    handleSessionLost();
    throw new ApiError('Session expired. Please sign in again.', { code: 'no_session', status: 401 });
  }

  const url = apiUrl(path);
  const init = {
    method,
    headers: { 'Content-Type': 'application/json', 'OAuth-Token': token, ...headers },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  log(method, path);

  let res;
  let attempt = 0;
  for (;;) {
    try {
      res = await fetch(url, init);
    } catch {
      if (retry && attempt < config.maxRetries) {
        attempt += 1;
        meta.retries += 1;
        await sleep(backoff(attempt));
        continue;
      }
      throw new ApiError('Network error — could not reach SugarCRM.', { code: 'network' });
    }

    const transient = res.status === 429 || res.status >= 500;
    if (transient && retry && attempt < config.maxRetries) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt);
      attempt += 1;
      meta.retries += 1;
      await sleep(wait);
      continue;
    }
    break;
  }

  meta.status = res.status;

  if (res.status === 401 && !_isRetryAfter401) {
    try {
      await refresh();
    } catch {
      handleSessionLost();
      throw new ApiError('Session expired. Please sign in again.', { code: 'unauthorized', status: 401 });
    }
    return _request(path, options, meta, true);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    if (res.status === 401) handleSessionLost();
    const message = data?.error_message || data?.error || `Request failed (${res.status}).`;
    log('error', res.status, message);
    throw new ApiError(message, { code: data?.error, status: res.status, data });
  }

  return data;
}

export const api = {
  get: (path, opts) => apiFetch(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => apiFetch(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => apiFetch(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts) => apiFetch(path, { ...opts, method: 'DELETE' }),
};

// Current authenticated user — handy for validating the session on load and
// showing who is signed in.
export function currentUser() {
  return api.get('me').then((r) => r?.current_user ?? r);
}
