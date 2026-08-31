// Booking edit form (Phase 5.3) — change date/time, service, status and notes
// on an existing booking. Account and pet are fixed; a group edit applies the
// same changes to every record sharing the group id.

import { config } from './config.js';
import { getEnumList } from './enums.js';
import { toDateInput, toTimeInput, fromDateTimeInputs } from './datetime.js';
import { setBusy } from './ui.js';

const B = config.bookings;
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

// booking: the raw SugarCRM record. groupSize: number of records in its group.
export function renderBookingEditForm(body, booking, { groupSize = 1, onCancel, onSubmit }) {
  const f = B.fields;
  const start = booking[f.start] ? new Date(booking[f.start]) : new Date();
  const end = booking[f.end]
    ? new Date(booking[f.end])
    : new Date(start.getTime() + B.defaultDurationMin * 60000);

  body.innerHTML = `
    <form id="booking-edit" class="bform" novalidate>
      <div class="bform-when">
        <label class="field">
          <span class="field-label">Date</span>
          <input type="date" name="date" value="${toDateInput(start)}" required />
        </label>
        <label class="field">
          <span class="field-label">Start</span>
          <input type="time" name="startTime" value="${toTimeInput(start)}" required />
        </label>
        <label class="field">
          <span class="field-label">End</span>
          <input type="time" name="endTime" value="${toTimeInput(end)}" required />
        </label>
      </div>

      <label class="field">
        <span class="field-label">Status</span>
        <select name="status"></select>
      </label>

      <label class="field">
        <span class="field-label">Service type</span>
        <select name="service"><option value="">—</option></select>
      </label>

      <label class="field">
        <span class="field-label">Notes / special instructions</span>
        <textarea name="notes" rows="3">${esc(booking[f.notes] || '')}</textarea>
      </label>

      ${
        groupSize > 1
          ? `<label class="checkline">
               <input type="checkbox" name="applyToGroup" />
               Apply these changes to all ${groupSize} bookings in this group
             </label>`
          : ''
      }

      <p id="edit-error" class="form-error" role="alert" hidden></p>

      <div class="modal-actions">
        <button type="button" class="btn btn--ghost" data-act="cancel">Cancel</button>
        <button type="submit" class="btn btn--primary">Save changes</button>
      </div>
    </form>`;

  const form = body.querySelector('#booking-edit');
  const errorBox = body.querySelector('#edit-error');
  const submitBtn = form.querySelector('button[type="submit"]');

  populateEnum(form.elements.status, f.status, booking[f.status], { includeBlank: false });
  populateEnum(form.elements.service, f.service, booking[f.service], { includeBlank: true });

  form.querySelector('[data-act="cancel"]').addEventListener('click', () => onCancel?.());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorBox.hidden = true;

    const startAt = fromDateTimeInputs(form.elements.date.value, form.elements.startTime.value);
    const endAt = fromDateTimeInputs(form.elements.date.value, form.elements.endTime.value);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      errorBox.textContent = 'Enter a valid date with an end time after the start time.';
      errorBox.hidden = false;
      return;
    }

    const changes = {
      [f.start]: startAt.toISOString(),
      [f.end]: endAt.toISOString(),
      [f.notes]: form.elements.notes.value.trim(),
    };
    // Keep the derived fields in step with the new times.
    if (f.bookingDateTime) changes[f.bookingDateTime] = startAt.toISOString();
    if (f.booking_length) {
      changes[f.booking_length] = Math.round((endAt.getTime() - startAt.getTime()) / 36000) / 100;
    }
    if (f.status) changes[f.status] = form.elements.status.value;
    if (f.service) changes[f.service] = form.elements.service.value;

    const applyToGroup = Boolean(form.elements.applyToGroup?.checked);

    const result = onSubmit?.(changes, { applyToGroup });
    if (result?.then) {
      setBusy(submitBtn, true, 'Saving…');
      result.catch((err) => {
        setBusy(submitBtn, false);
        errorBox.textContent = err?.message || 'Could not save changes.';
        errorBox.hidden = false;
      });
    }
  });
}

async function populateEnum(selectEl, field, current, { includeBlank }) {
  if (!field || !selectEl) return;
  const staticOpts =
    field === B.fields.service && B.serviceOptions
      ? Object.entries(B.serviceOptions).map(([value, label]) => ({ value, label }))
      : null;
  const opts = staticOpts || (await getEnumList(B.module, field));

  if (!includeBlank) selectEl.innerHTML = '';
  for (const o of opts) {
    const el = document.createElement('option');
    el.value = o.value;
    el.textContent = o.label;
    if (o.value === current) el.selected = true;
    selectEl.appendChild(el);
  }
  // Keep an unknown current value selectable.
  if (current && !opts.some((o) => o.value === current)) {
    const el = document.createElement('option');
    el.value = current;
    el.textContent = current;
    el.selected = true;
    selectEl.appendChild(el);
  }
}
