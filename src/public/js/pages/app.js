// Authenticated app shell — session, current user, permissions, calendar.

import { initAuth, logout, setSessionLostHandler } from '../auth.js';
import { requireAuth } from '../session.js';
import { currentUser } from '../api.js';
import { toast, mountProgressBar } from '../ui.js';
import { mountCalendar } from '../calendar.js';
import { store } from '../store.js';
import { loadAcl } from '../acl.js';

if (requireAuth()) {
  setSessionLostHandler(() => {
    window.location.replace('login.html?expired=1');
  });
  initAuth();
  mountProgressBar(document.getElementById('progress-bar'));
  boot();
}

async function boot() {
  const whoami = document.getElementById('whoami');

  try {
    const user = await currentUser();
    store.set({ user });
    whoami.textContent =
      user?.full_name ||
      [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
      user?.user_name ||
      'Signed in';
  } catch (err) {
    // A hard 401 already redirected; anything else is non-fatal here.
    whoami.textContent = 'Signed in';
    if (err?.status !== 401) toast(err.message || 'Could not load your profile.', 'error');
  }

  // Load module permissions before the calendar so create/edit/delete gating is
  // ready by the time the user can act; a failure here defaults to permissive.
  await loadAcl();

  const calendarEl = document.getElementById('calendar');
  if (calendarEl) mountCalendar(calendarEl);

  document.getElementById('logout-btn').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    await logout();
    window.location.replace('login.html?loggedout=1');
  });
}
