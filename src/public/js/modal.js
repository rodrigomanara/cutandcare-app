// Generic modal dialog built on the native <dialog> element (focus trap, Esc,
// and backdrop handling come for free).

export function openModal({ title, render, onClose }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.innerHTML = `
    <div class="modal-head">
      <h2 class="modal-title"></h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body"></div>`;

  dlg.querySelector('.modal-title').textContent = title;
  dlg.querySelector('.modal-close').addEventListener('click', () => dlg.close('cancel'));

  // Click on the backdrop (outside the dialog box) closes it.
  dlg.addEventListener('click', (e) => {
    const r = dlg.getBoundingClientRect();
    const inside =
      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dlg.close('cancel');
  });

  dlg.addEventListener('close', () => {
    dlg.remove();
    onClose?.(dlg.returnValue);
  });

  const close = (value) => dlg.close(value ?? 'ok');
  render(dlg.querySelector('.modal-body'), close);

  document.body.appendChild(dlg);
  dlg.showModal();
  return dlg;
}

// Promise-based confirmation. Resolves true on confirm, false otherwise.
export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title,
      render: (body, close) => {
        body.innerHTML = `
          <p class="confirm-message"></p>
          <div class="modal-actions">
            <button type="button" class="btn btn--ghost" data-act="cancel"></button>
            <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-act="ok"></button>
          </div>`;
        body.querySelector('.confirm-message').textContent = message;
        body.querySelector('[data-act="cancel"]').textContent = cancelLabel;
        body.querySelector('[data-act="ok"]').textContent = confirmLabel;
        body.querySelector('[data-act="cancel"]').addEventListener('click', () => close('cancel'));
        body.querySelector('[data-act="ok"]').addEventListener('click', () => {
          answered = true;
          resolve(true);
          close('ok');
        });
      },
      onClose: () => {
        if (!answered) resolve(false);
      },
    });
  });
}
