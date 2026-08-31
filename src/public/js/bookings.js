// Bookings data layer — reads the custom SugarCRM bookings module and maps
// records to the shape FullCalendar expects.
//
// Module API name and field names are configured in config.js (config.bookings).

import { api } from './api.js';
import { config } from './config.js';

const B = config.bookings;
const modulePath = encodeURIComponent(B.module);

function selectedFields() {
  const f = B.fields;
  return [f.title, f.start, f.end, f.status, f.account, f.pet].filter(Boolean).join(',');
}

// SugarCRM record -> FullCalendar event object.
export function recordToEvent(rec) {
  const f = B.fields;
  const status = rec[f.status] ?? null;
  const color = B.statusColors[status] ?? B.statusColorDefault;
  return {
    id: rec.id,
    title: rec[f.title] || '(untitled booking)',
    start: rec[f.start] || null,
    end: rec[f.end] || undefined,
    backgroundColor: color,
    borderColor: color,
    extendedProps: {
      status,
      accountId: rec[f.account] ?? null,
      petId: rec[f.pet] ?? null,
      record: rec,
    },
  };
}

// Fetch every booking whose start falls within [startStr, endStr], paging
// through the SugarCRM filter endpoint until it is exhausted.
export async function listBookings({ startStr, endStr }) {
  const f = B.fields;
  const events = [];
  let offset = 0;

  for (;;) {
    const res = await api.post(`${modulePath}/filter`, {
      filter: [{ [f.start]: { $gte: startStr } }, { [f.start]: { $lte: endStr } }],
      fields: selectedFields(),
      max_num: B.pageSize,
      offset,
      order_by: `${f.start}:asc`,
    });

    const records = res?.records ?? [];
    for (const rec of records) events.push(recordToEvent(rec));

    const next = res?.next_offset ?? -1;
    if (next === -1 || next <= offset || records.length === 0) break;
    offset = next;
  }

  return events;
}

// Full record for one booking (Phase 5 read view).
export function getBooking(id) {
  return api.get(`${modulePath}/${encodeURIComponent(id)}`);
}

// The single related record on one of the booking's relationship links
// (e.g. its account or pet), or null. Bookings are linked via the SugarCRM
// relationship endpoint, not a relate id field, so this is how the read views
// resolve the account / pet behind a booking.
export async function getBookingRelated(bookingId, linkName) {
  if (!bookingId || !linkName) return null;
  const res = await api.get(
    `${modulePath}/${encodeURIComponent(bookingId)}/link/${encodeURIComponent(linkName)}?max_num=1`,
  );
  return (res?.records ?? [])[0] ?? null;
}

// --- Phase 5: update / delete / group / history ------------------

export function isBookingLocked(status) {
  return Boolean(status && B.lockedStatuses?.includes(status));
}

export function updateBooking(id, fields) {
  return api.put(`${modulePath}/${encodeURIComponent(id)}`, fields);
}

// Hard DELETE, or a soft archive (status -> archiveStatus) per config.
export function deleteBooking(id) {
  if (B.deleteMode === 'soft' && B.fields.status && B.archiveStatus) {
    return api.put(`${modulePath}/${encodeURIComponent(id)}`, {
      [B.fields.status]: B.archiveStatus,
    });
  }
  return api.delete(`${modulePath}/${encodeURIComponent(id)}`);
}

// Every record sharing a group id (the set created from one multi-pet submit).
export async function listGroupMembers(groupId) {
  const f = B.fields;
  if (!groupId || !f.group) return [];
  const res = await api.post(`${modulePath}/filter`, {
    filter: [{ [f.group]: groupId }],
    fields: [f.title, f.start, f.end, f.status, f.pet, f.account, f.group]
      .filter(Boolean)
      .join(','),
    max_num: 200,
    order_by: `${f.title}:asc`,
  });
  return (res?.records ?? []).map((r) => ({
    id: r.id,
    title: r[f.title] || '(untitled)',
    status: r[f.status] ?? null,
    petId: r[f.pet] ?? null,
    record: r,
  }));
}

async function applyToGroup(groupId, fn) {
  const members = await listGroupMembers(groupId);
  const settled = await Promise.allSettled(members.map((m) => fn(m.id)));
  const failed = settled.filter((s) => s.status === 'rejected').length;
  return { total: members.length, failed };
}

export function updateBookingGroup(groupId, fields) {
  return applyToGroup(groupId, (id) => updateBooking(id, fields));
}

export function deleteBookingGroup(groupId) {
  return applyToGroup(groupId, (id) => deleteBooking(id));
}

// Field-level change history. Returns [] when the audit API is unavailable.
export async function getBookingAudit(id) {
  try {
    const res = await api.get(
      `${modulePath}/${encodeURIComponent(id)}/audit?max_num=25&order_by=date_created:desc`,
    );
    return (res?.records ?? []).map((r) => ({
      field: r.field_name,
      before: r.before,
      after: r.after,
      date: r.date_created,
      user: r.created_by_name || r.created_by || '',
    }));
  } catch {
    return [];
  }
}
