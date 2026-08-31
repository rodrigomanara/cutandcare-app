// Login page controller.

import { login } from '../auth.js';
import { redirectIfAuthenticated, safeNext } from '../session.js';
import { setBusy, toast } from '../ui.js';

redirectIfAuthenticated();

const form = document.getElementById('login-form');
const username = document.getElementById('username');
const password = document.getElementById('password');
const submit = document.getElementById('login-submit');
const errorBox = document.getElementById('login-error');

// Explain why the user landed back here, if applicable.
const params = new URLSearchParams(window.location.search);
if (params.get('expired') === '1') {
  showError('Your session expired. Please sign in again.');
} else if (params.get('loggedout') === '1') {
  toast('You have been signed out.', 'info');
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = '';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const user = username.value.trim();
  const pass = password.value;
  if (!user || !pass) {
    showError('Enter your username and password.');
    return;
  }

  setBusy(submit, true, 'Signing in…');
  try {
    await login(user, pass);
    const next = safeNext(params.get('next')) || 'index.html';
    window.location.replace(next);
  } catch (err) {
    setBusy(submit, false);
    password.value = '';
    showError(err.message || 'Sign in failed. Please try again.');
    username.focus();
  }
});
