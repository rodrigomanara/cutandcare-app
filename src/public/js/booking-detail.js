// Booking detail view (Phase 5.2) with edit (5.3) and delete (5.4).

import { openModal, confirmDialog } from './modal.js';
import { renderBookingEditForm } from './booking-edit-form.js';
import {
  getBooking,
  getBookingRelated,
  getBookingAudit,
  listGroupMembers,
  isBookingLocked,
  updateBooking,
  updateBookingGroup,
  deleteBooking,
  deleteBookingGroup,
} from './bookings.js';
import { getAccount } from './accounts.js';
import { getPet } from './pets.js';
import { can } from './acl.js';
import { config } from './config.js';
import { formatDate, formatTime, formatSlot } from './datetime.js';
import { toast } from './ui.js';

const B = config.bookings;
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const statusLabel = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown');
const statusColor = (s) => B.statusColors[s] || B.statusColorDefault;

export function openBookingDetail({ event, onChanged }) {
  const id = event.id;

  openModal({
    title: 'Booking',
    render: (body, close) => {
      body.innerHTML = '<p class="muted">Loading booking…</p>';
      load(id, body, close, onChanged).catch((err) => {
        body.innerHTML = `<p class="form-error">${esc(err.message || 'Could not load the booking.')}</p>`;
      });
    },
  });
}

async function load(id, body, close, onChanged) {
  const booking = await getBooking(id);
  const f = B.fields;

  const groupId = f.group ? booking[f.group] : null;

  const [account, pet, group, audit] = await Promise.all([
    resolveLinked(id, B.links?.account, getAccount),
    resolveLinked(id, B.links?.pet, getPet),
    groupId ? listGroupMembers(groupId).catch(() => []) : [],
    getBookingAudit(id),
  ]);

  const status = booking[f.status] ?? null;
  const locked = isBookingLocked(status);
  renderView(body, { booking, account, pet, group, audit, status, locked }, { close, onChanged });
}

// Resolve the account / pet behind a booking through its relationship link,
// then load the full record for display. Any failure -> null (the view falls
// back to the relate `_name` field on the booking).
async function resolveLinked(bookingId, linkName, fetchFull) {
  try {
    const rec = await getBookingRelated(bookingId, linkName);
    return rec?.id ? await fetchFull(rec.id) : null;
  } catch {
    return null;
  }
}

function renderView(body, model, { close, onChanged }) {
  const { booking, account, pet, group, audit, status, locked } = model;
  const f = B.fields;

  const when = booking[f.start]
    ? formatSlot(booking[f.start], booking[f.end], false)
    : '—';

  const rows = [
    ['When', esc(when)],
    ['Status', `<span style="color:${statusColor(status)}">${esc(statusLabel(status))}</span>`],
    booking[f.service] ? ['Service', esc(booking[f.service])] : null,
    ['Account', account ? esc(account.name) : esc(booking[f.account] || '—')],
    account && account.phone ? ['Phone', esc(account.phone)] : null,
    account && account.email ? ['Email', esc(account.email)] : null,
    ['Pet', pet ? esc([pet.name, pet.breed].filter(Boolean).join(' · ')) : esc(booking[f.pet] || '—')],
    booking[f.notes] ? ['Notes', esc(booking[f.notes])] : null,
  ].filter(Boolean);

  body.innerHTML = `
    <dl class="kv">
      ${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}
    </dl>

    ${
      group.length > 1
        ? `<p class="group-note">Part of a group of ${group.length} bookings:
             ${group.map((m) => esc(m.title)).join(', ')}.</p>`
        : ''
    }

    ${locked ? `<p class="modal-note">This booking is ${esc(statusLabel(status))} and cannot be edited.</p>` : ''}
    ${!can('edit') && !can('delete') ? '<p class="modal-note">You have read-only access to bookings.</p>' : ''}

    <details class="history"${audit.length ? '' : ' hidden'}>
      <summary>History (${audit.length})</summary>
      <ul>
        ${audit
          .map(
            (a) =>
              `<li><span class="muted">${esc(historyWhen(a.date))}</span> — ` +
              `<strong>${esc(a.field)}</strong>: ${esc(a.before ?? '∅')} → ${esc(a.after ?? '∅')}` +
              `${a.user ? ` <span class="muted">(${esc(a.user)})</span>` : ''}</li>`,
          )
          .join('')}
      </ul>
    </details>

    <div class="modal-actions">
      <button type="button" class="btn btn--ghost" data-act="close">Close</button>
      ${can('delete') ? '<button type="button" class="btn btn--ghost btn--danger" data-act="delete">Delete</button>' : ''}
      ${
        can('edit')
          ? `<button type="button" class="btn btn--primary" data-act="edit"${locked ? ' disabled' : ''}>Edit</button>`
          : ''
      }
    </div>`;

  body.querySelector('[data-act="close"]').addEventListener('click', () => close('close'));

  body.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
    if (locked) return;
    openEdit(body, { booking, group }, { close, onChanged });
  });

  body.querySelector('[data-act="delete"]')?.addEventListener('click', () =>
    handleDelete({ booking, group }, { close, onChanged }),
  );
}

function openEdit(body, { booking, group }, { close, onChanged }) {
  const groupSize = group.length > 1 ? group.length : 1;
  renderBookingEditForm(body, booking, {
    groupSize,
    onCancel: () => close('cancel'),
    onSubmit: async (changes, { applyToGroup }) => {
      const groupId = B.fields.group ? booking[B.fields.group] : null;
      if (applyToGroup && groupId) {
        const { total, failed } = await updateBookingGroup(groupId, changes);
        toast(
          failed
            ? `Updated ${total - failed} of ${total} bookings.`
            : `Updated ${total} bookings.`,
          failed ? 'error' : 'success',
        );
      } else {
        await updateBooking(booking.id, changes);
        toast('Booking updated.', 'success');
      }
      close('ok');
      onChanged?.();
    },
  });
}

async function handleDelete({ booking, group }, { close, onChanged }) {
  const inGroup = group.length > 1;
  const soft = B.deleteMode === 'soft';
  const verb = soft ? 'Archive' : 'Delete';

  let scope = 'one';
  if (inGroup) {
    scope = await pickDeleteScope(group.length, verb);
    if (!scope) return;
  } else {
    const ok = await confirmDialog({
      title: `${verb} booking`,
      message: soft
        ? 'This booking will be archived (status set for the audit trail).'
        : 'This booking will be permanently deleted.',
      confirmLabel: verb,
      danger: !soft,
    });
    if (!ok) return;
  }

  try {
    if (scope === 'all') {
      const groupId = booking[B.fields.group];
      const { total, failed } = await deleteBookingGroup(groupId);
      toast(
        failed ? `${verb}d ${total - failed} of ${total} bookings.` : `${verb}d ${total} bookings.`,
        failed ? 'error' : 'success',
      );
    } else {
      await deleteBooking(booking.id);
      toast(`Booking ${verb.toLowerCase()}d.`, 'success');
    }
    close('deleted');
    onChanged?.();
  } catch (err) {
    toast(err.message || `Could not ${verb.toLowerCase()} the booking.`, 'error');
  }
}

// Returns 'one' | 'all' | null.
function pickDeleteScope(count, verb) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title: `${verb} booking`,
      render: (body, close) => {
        body.innerHTML = `
          <p>This booking is part of a group of ${count}.</p>
          <div class="modal-actions modal-actions--stack">
            <button type="button" class="btn btn--ghost" data-act="cancel">Cancel</button>
            <button type="button" class="btn btn--ghost btn--danger" data-act="one">${verb} this one only</button>
            <button type="button" class="btn btn--danger" data-act="all">${verb} all ${count}</button>
          </div>`;
        const pick = (v) => {
          answered = true;
          resolve(v);
          close('ok');
        };
        body.querySelector('[data-act="cancel"]').addEventListener('click', () => close('cancel'));
        body.querySelector('[data-act="one"]').addEventListener('click', () => pick('one'));
        body.querySelector('[data-act="all"]').addEventListener('click', () => pick('all'));
      },
      onClose: () => {
        if (!answered) resolve(null);
      },
    });
  });
}

function historyWhen(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return `${formatDate(date)}, ${formatTime(date)}`;
}
