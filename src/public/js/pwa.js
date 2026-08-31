// Progressive-web-app glue: registers the service worker and surfaces a native
// "Install" affordance when the browser offers one.
//
// Loaded from both index.html and login.html. Safe to run more than once.

const SW_URL = '/sw.js';

export function initPwa() {
  registerServiceWorker();
  wireInstallPrompt();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // file:// (native wrapper dev) can't host a SW — skip quietly.
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_URL, { scope: '/' }).catch((err) => {
      console.warn('[pwa] service worker registration failed:', err?.message || err);
    });
  });
}

function wireInstallPrompt() {
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // stop Chrome's mini-infobar; we show our own button
    deferred = e;
    showInstallButton(async () => {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice.catch(() => {});
      deferred = null;
      removeInstallButton();
    });
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    removeInstallButton();
  });
}

function showInstallButton(onClick) {
  if (document.getElementById('install-app-btn')) return;

  const host = document.querySelector('.app-bar-user') || document.querySelector('.auth-card__content');
  if (!host) return;

  const btn = document.createElement('button');
  btn.id = 'install-app-btn';
  btn.type = 'button';
  btn.className = 'btn btn--ghost btn--sm';
  btn.textContent = 'Install app';
  btn.addEventListener('click', onClick);
  host.prepend(btn);
}

function removeInstallButton() {
  document.getElementById('install-app-btn')?.remove();
}

initPwa();
