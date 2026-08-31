// Tiny UI helpers: toast notifications, button busy state, top progress bar.

import { onActivityChange } from './activity.js';

let toastHost = null;

function host() {
  if (toastHost && document.body.contains(toastHost)) return toastHost;
  toastHost = document.createElement('div');
  toastHost.className = 'toast-host';
  toastHost.setAttribute('role', 'status');
  toastHost.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastHost);
  return toastHost;
}

export function toast(message, type = 'info', timeoutMs = 4500) {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  host().appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--in'));

  const remove = () => {
    el.classList.remove('toast--in');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  const timer = setTimeout(remove, timeoutMs);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

// Wire a thin top-of-page bar to global request activity. Pass the bar element
// (or it creates one appended to <body>).
export function mountProgressBar(el) {
  const bar = el || Object.assign(document.createElement('div'), { className: 'progress-bar' });
  if (!bar.isConnected) document.body.appendChild(bar);
  let hideTimer;
  onActivityChange((inFlight) => {
    clearTimeout(hideTimer);
    if (inFlight > 0) {
      bar.classList.add('progress-bar--on');
    } else {
      // brief settle so very fast calls still flash
      hideTimer = setTimeout(() => bar.classList.remove('progress-bar--on'), 150);
    }
  });
  return bar;
}

// Toggle a button into a loading state, preserving its label.
export function setBusy(button, busy, busyLabel = 'Working…') {
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.classList.add('is-busy');
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span>${busyLabel}`;
  } else {
    button.disabled = false;
    button.classList.remove('is-busy');
    button.textContent = button.dataset.label ?? button.textContent;
  }
}
