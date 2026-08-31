// Multi-pet booking generation + validation (Phase 4).
//
// createBookings(payload) validates the request, then creates one SugarCRM
// record per selected pet sharing the same slot / location / notes and a common
// group id. Returns { groupId, created[], failed[] }.

import { api } from './api.js';
import { config } from './config.js';

const B = config.bookings;
const modulePath = encodeURIComponent(B.module);

export class BookingValidationError extends Error {
  constructor(messages) {
    super(messages.join('\n'));
    this.name = 'BookingValidationError';
    this.messages = messages;
  }
}

function newGroupId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `grp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bookingTitle(payload, pet) {
  const prefix = payload.serviceLabel || 'Booking';
  return `${prefix} — ${pet.name}`;
}

// --- validation (spec 4.2) -----------------------------------------

export async function validateBooking(payload) {
  const errors = [];

  if (!(payload.start instanceof Date) || Number.isNaN(payload.start.getTime())) {
    errors.push('Choose a valid start date and time.');
  } else if (payload.start.getTime() <= Date.now()) {
    errors.push('The booking must start in the future.');
  }
  if (payload.end instanceof Date && payload.end <= payload.start) {
    errors.push('The end time must be after the start time.');
  }

  if (!payload.account?.id) errors.push('Select an account.');
  else if (payload.account.active === false) {
    errors.push(`${payload.account.name || 'This account'} is not an active customer.`);
  }

  if (!payload.pets?.length) errors.push('Select at least one pet.');
  const inactive = (payload.pets || []).filter((p) => p.active === false).map((p) => p.name);
  if (inactive.length) errors.push(`Not active: ${inactive.join(', ')}.`);

  // Double-booking — only runs once the basics are sound. Fails open: a filter
  // error (e.g. a mismatched pet field name) must not block a legitimate save.
  if (!errors.length) {
    try {
      const clashing = await findClashingPets(
        payload.pets.map((p) => p.id),
        payload.start,
        payload.end,
      );
      if (clashing.size) {
        const names = payload.pets.filter((p) => clashing.has(p.id)).map((p) => p.name);
        errors.push(`Already booked for this time: ${names.join(', ')}.`);
      }
    } catch (err) {
      console.warn('[booking] double-booking check skipped:', err?.message || err);
    }
  }

  if (errors.length) throw new BookingValidationError(errors);
}

// Set of pet ids that already have an overlapping, still-active booking.
async function findClashingPets(petIds, start, end) {
  const f = B.fields;
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const clashing = new Set();

  await Promise.all(
    petIds.map(async (petId) => {
      const filter = [
        { [f.petId || f.pet]: petId },
        { [f.start]: { $lt: endIso } },
        { [f.end]: { $gt: startIso } },
      ];
      if (f.status && B.freeingStatuses?.length) {
        filter.push({ [f.status]: { $not_in: B.freeingStatuses } });
      }
      const res = await api.post(`${modulePath}/filter`, { filter, fields: 'id', max_num: 1 });
      if ((res?.records ?? []).length) clashing.add(petId);
    }),
  );

  return clashing;
}

// Split [start, end] into `n` equal, back-to-back slots. Any rounding remainder
// is absorbed by the last slot so it always ends exactly on `end`.
// e.g. 09:00–14:00 with n=2 -> [09:00–11:30, 11:30–14:00].
export function splitSlots(start, end, n) {
  const startMs = start.getTime();
  const totalMs = end.getTime() - startMs;
  const step = Math.floor(totalMs / n);
  const slots = [];
  for (let i = 0; i < n; i += 1) {
    slots.push({
      start: new Date(startMs + step * i),
      end: i === n - 1 ? new Date(end.getTime()) : new Date(startMs + step * (i + 1)),
    });
  }
  return slots;
}

// Link a freshly created booking to a related record via the SugarCRM
// relationship endpoint. Setting a relate `_name` field on create does not
// establish the link — this does.
async function linkRelated(bookingId, linkName, relatedId) {
  if (!bookingId || !linkName || !relatedId) return;
  await api.post(`${modulePath}/${encodeURIComponent(bookingId)}/link`, {
    link_name: linkName,
    ids: [relatedId],
  });
}

// --- creation (spec 4.1) ------------------------------------------

export async function createBookings(payload) {
  await validateBooking(payload);

  const f = B.fields;
  const links = B.links || {};
  const groupId = newGroupId();

  // One equal, consecutive slot per pet (a single pet keeps the whole range).
  const slots =
    payload.pets.length > 1
      ? splitSlots(payload.start, payload.end, payload.pets.length)
      : [{ start: payload.start, end: payload.end }];

  const shared = { [f.status]: B.newStatus };
  if (f.sendReminder) shared[f.sendReminder] = true;
  if (f.reminderIn) shared[f.reminderIn] = B.reminderLeadHours ?? 8;
  if (f.service && payload.service) shared[f.service] = payload.service;
  if (f.notes) shared[f.notes] = payload.notes || '';
  if (f.location) shared[f.location] = payload.location || B.defaultLocation || '';
  if (f.group) shared[f.group] = groupId;

  const created = [];
  const failed = [];
  const linkWarnings = [];

  // Sequential: clearer partial-failure reporting and gentler on rate limits.
  for (let i = 0; i < payload.pets.length; i += 1) {
    const pet = payload.pets[i];
    const slot = slots[i];
    // booking_length_c is stored in hours (e.g. a 2h30m slot -> 2.5).
    const lengthHours = Math.round((slot.end.getTime() - slot.start.getTime()) / 36000) / 100;

    const record = {
      ...shared,
      [f.title]: bookingTitle(payload, pet),
      [f.start]: slot.start.toISOString(),
      [f.end]: slot.end.toISOString(),
    };
    // booking_date_time_c holds the booking's start datetime.
    if (f.bookingDateTime) record[f.bookingDateTime] = slot.start.toISOString();
    if (f.booking_length) record[f.booking_length] = lengthHours;

    let bookingId = null;
    try {
      const res = await api.post(modulePath, record);
      bookingId = res?.id ?? null;
      created.push({ id: bookingId, petId: pet.id, petName: pet.name });
    } catch (err) {
      failed.push({ petId: pet.id, petName: pet.name, error: err.message });
      continue;
    }

    // Relationship links — the record exists even if these fail, so a failure
    // is a warning, not a hard error.
    try {
      await linkRelated(bookingId, links.account, payload.account.id);
      await linkRelated(bookingId, links.pet, pet.id);
    } catch (err) {
      linkWarnings.push(`${pet.name}: ${err.message}`);
    }
  }

  if (created.length === 0) {
    throw new Error(`Could not create bookings: ${failed[0]?.error || 'unknown error'}`);
  }

  return { groupId, created, failed, linkWarnings };
}
