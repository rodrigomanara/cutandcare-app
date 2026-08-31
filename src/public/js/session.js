// Route guards shared by the app pages.

import { isAuthenticated } from './auth.js';

// Only allow same-directory relative targets as post-login redirects, so a
// crafted ?next= cannot bounce the user to another origin.
function safeNext(value) {
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null; // has a scheme
  if (value.startsWith('//') || value.startsWith('/')) return null; // host / absolute
  if (value.includes('..')) return null;
  return value;
}

// Call at the top of an authenticated page. Returns false (and redirects) when
// there is no live session.
export function requireAuth() {
  if (isAuthenticated()) return true;
  const here = window.location.pathname.split('/').pop() + window.location.search;
  window.location.replace(`login.html?next=${encodeURIComponent(here)}`);
  return false;
}

// Call at the top of the login page. Sends already-authenticated users on to
// the app (honouring ?next= when it is safe).
export function redirectIfAuthenticated() {
  if (!isAuthenticated()) return;
  const next = safeNext(new URLSearchParams(window.location.search).get('next'));
  window.location.replace(next || 'index.html');
}

export { safeNext };
