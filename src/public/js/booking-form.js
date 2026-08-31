// Booking form body (Phase 3).
//
// Renders into a modal body: editable date/time, a searchable account picker,
// a read-only account/contacts panel, a multi-select pet checklist, a service
// dropdown and a notes field. Calls onSubmit(payload) with a normalised object;
// actually persisting it (one record per pet + validation) is Phase 4.

import { config } from './config.js';
import { createCombobox } from './combobox.js';
import { searchAccounts, getAccount, getAccountContacts, isAccountActive } from './accounts.js';
import { listPetsForAccount } from './pets.js';
import { getEnumList } from './enums.js';
import { formatDate } from './datetime.js';
import { setBusy } from './ui.js';

const pad = (n) => String(n).padStart(2, '0');
const dateVal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeVal = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const combine = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}`);
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export function renderBookingForm(body, ctx, { onCancel, onSubmit }) {
  const start = ctx.start instanceof Date ? ctx.start : new Date(ctx.start);
  let end = ctx.end && !ctx.allDay ? new Date(ctx.end) : null;
  if (ctx.allDay) start.setHours(9, 0, 0, 0);
  if (!end) end = new Date(start.getTime() + config.bookings.defaultDurationMin * 60000);

  body.innerHTML = `
    <form id="booking-form" class="bform" novalidate>
      <div class="bform-row bform-when">
        <label class="field">
          <span class="field-label">Date</span>
          <input type="date" name="date" value="${dateVal(start)}" required />
        </label>
        <label class="field">
          <span class="field-label">Start</span>
          <input type="time" name="startTime" value="${timeVal(start)}" required />
        </label>
        <label class="field">
          <span class="field-label">End</span>
          <input type="time" name="endTime" value="${timeVal(end)}" required />
        </label>
      </div>

      <div class="field">
        <span class="field-label">Account</span>
        <div id="account-picker"></div>
      </div>

      <div id="account-panel" class="account-panel" hidden></div>

      <div class="field">
        <span class="field-label">Pets</span>
        <div id="pet-list" class="pet-list"><p class="muted">Select an account first.</p></div>
      </div>

      <label class="field">
        <span class="field-label">Service type</span>
        <select name="service"><option value="">—</option></select>
      </label>

      ${
        config.bookings.fields.location
          ? `<label class="field">
               <span class="field-label">Location</span>
               <input type="text" name="location" value="${esc(config.bookings.defaultLocation)}" />
             </label>`
          : ''
      }

      <label class="field">
        <span class="field-label">Notes / special instructions</span>
        <textarea name="notes" rows="3"></textarea>
      </label>

      <p id="bform-error" class="form-error" role="alert" hidden></p>

      <div class="modal-actions">
        <button type="button" class="btn btn--ghost" data-act="cancel">Cancel</button>
        <button type="submit" class="btn btn--primary" data-act="submit" disabled>Create booking</button>
      </div>
    </form>`;

  const form = body.querySelector('#booking-form');
  const errorBox = body.querySelector('#bform-error');
  const submitBtn = form.querySelector('[data-act="submit"]');
  const petListEl = body.querySelector('#pet-list');
  const panelEl = body.querySelector('#account-panel');
  const serviceSel = form.elements.service;

  const state = { account: null, pets: [], petsById: new Map() };

  // --- service options --------------------------------------------------
  const staticOptions = config.bookings.serviceOptions;
  (staticOptions
    ? Promise.resolve(Object.entries(staticOptions).map(([value, label]) => ({ value, label })))
    : getEnumList(config.bookings.module, config.bookings.fields.service)
  ).then((opts) => {
    for (const o of opts) {
      const el = document.createElement('option');
      el.value = o.value;
      el.textContent = o.label;
      serviceSel.appendChild(el);
    }
  });

  // --- account picker -------------------------------------------------
  createCombobox(body.querySelector('#account-picker'), {
    placeholder: 'Search customers…',
    onSearch: (term) => searchAccounts(term),
    onSelect: (item) => {
      state.account = item ? { id: item.id, name: item.label, active: true } : null;
      if (!item) {
        panelEl.hidden = true;
        panelEl.innerHTML = '';
        petListEl.innerHTML = '<p class="muted">Select an account first.</p>';
        state.pets = [];
        state.petsById.clear();
        updateValidity();
        return;
      }
      loadAccountPanel(item.id);
      loadPets(item.id);
      updateValidity();
    },
  });

  async function loadAccountPanel(id) {
    panelEl.hidden = false;
    panelEl.innerHTML = '<p class="muted">Loading account…</p>';
    try {
      const [acct, contacts] = await Promise.all([getAccount(id), getAccountContacts(id)]);
      const active = isAccountActive(acct);
      state.account = { id, name: acct.name, status: acct.status, active };
      panelEl.innerHTML = accountPanelHtml(acct, contacts, active);
      updateValidity();
    } catch (err) {
      panelEl.innerHTML = `<p class="form-error">${esc(err.message || 'Could not load account.')}</p>`;
    }
  }

  async function loadPets(accountId) {
    petListEl.innerHTML = '<p class="muted">Loading pets…</p>';
    try {
      const pets = await listPetsForAccount(accountId);
      state.petsById = new Map(pets.map((p) => [p.id, p]));
      if (!pets.length) {
        petListEl.innerHTML = '<p class="muted">This account has no pets on file.</p>';
        return;
      }
      petListEl.innerHTML = pets.map(petRowHtml).join('');
      petListEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.addEventListener('change', () => {
          state.pets = [...petListEl.querySelectorAll('input:checked')].map((i) => i.value);
          updateValidity();
        });
      });
    } catch (err) {
      petListEl.innerHTML = `<p class="form-error">${esc(err.message || 'Could not load pets.')}</p>`;
    }
  }

  function readWhen() {
    const d = form.elements.date.value;
    const s = form.elements.startTime.value;
    const e = form.elements.endTime.value;
    if (!d || !s || !e) return null;
    const startAt = combine(d, s);
    const endAt = combine(d, e);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
    if (endAt <= startAt) return null;
    return { startAt, endAt };
  }

  function updateValidity() {
    const ok = Boolean(state.account && state.pets.length && readWhen());
    submitBtn.disabled = !ok;
  }

  ['date', 'startTime', 'endTime'].forEach((n) =>
    form.elements[n].addEventListener('input', updateValidity),
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorBox.hidden = true;

    const when = readWhen();
    if (!when) {
      showError('Enter a valid date with an end time after the start time.');
      return;
    }
    if (!state.account) return showError('Choose an account.');
    if (!state.pets.length) return showError('Select at least one pet.');

    const payload = {
      account: { ...state.account },
      pets: state.pets.map((id) => {
        const p = state.petsById.get(id);
        return { id, name: p?.name || id, active: p ? p.active : true };
      }),
      service: serviceSel.value || null,
      serviceLabel: serviceSel.value ? serviceSel.selectedOptions[0]?.textContent || null : null,
      notes: form.elements.notes.value.trim(),
      location: form.elements.location ? form.elements.location.value.trim() : '',
      start: when.startAt,
      end: when.endAt,
    };

    const result = onSubmit?.(payload);
    if (result?.then) {
      setBusy(submitBtn, true, 'Saving…');
      result.catch((err) => {
        setBusy(submitBtn, false);
        showError(
          err?.messages?.length ? err.messages.join('\n') : err?.message || 'Could not save the booking.',
        );
      });
    }
  });

  form.querySelector('[data-act="cancel"]').addEventListener('click', () => onCancel?.());

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }
}

// --- markup helpers ---------------------------------------------------

function accountPanelHtml(acct, contacts, active = true) {
  const rows = [
    ['Phone', acct.phone],
    ['Email', acct.email],
    ['Address', acct.address],
  ].filter(([, v]) => v);

  const contactHtml = contacts.length
    ? `<div class="account-contacts">
         <span class="field-label">Contacts</span>
         <ul>${contacts
           .map(
             (c) =>
               `<li><strong>${esc(c.name)}</strong>${c.title ? ` · ${esc(c.title)}` : ''}<br />` +
               `<span class="muted">${[c.phone, c.email].filter(Boolean).map(esc).join(' · ')}</span></li>`,
           )
           .join('')}</ul>
       </div>`
    : '';

  return `
    <div class="account-head">
      <strong>${esc(acct.name)}</strong>
      ${active ? '' : '<span class="tag tag--warn">Inactive</span>'}
    </div>
    <dl class="kv">
      ${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}
    </dl>
    ${contactHtml}`;
}

function petRowHtml(p) {
  const meta = [p.breed, p.age ? `${p.age} old` : p.dob ? formatDate(p.dob) : '']
    .filter(Boolean)
    .map(esc)
    .join(' · ');
  const health = [
    p.allergies && `Allergies: ${p.allergies}`,
    p.healthNotes && `Notes: ${p.healthNotes}`,
  ]
    .filter(Boolean)
    .map(esc)
    .join(' — ');

  return `
    <label class="pet-row${p.active ? '' : ' pet-row--inactive'}">
      <input type="checkbox" value="${esc(p.id)}"${p.active ? '' : ' disabled'} />
      <span class="pet-main">
        <span class="pet-name">${esc(p.name)}${p.active ? '' : ' <em>(inactive)</em>'}</span>
        ${meta ? `<span class="pet-meta">${meta}</span>` : ''}
        ${health ? `<span class="pet-health">${health}</span>` : ''}
      </span>
    </label>`;
}
