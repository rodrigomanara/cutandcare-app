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

  // Double-booking — only runs once the basics are sound.
  if (!errors.length) {
    const clashing = await findClashingPets(
      payload.pets.map((p) => p.id),
      payload.start,
      payload.end,
    );
    if (clashing.size) {
      const names = payload.pets.filter((p) => clashing.has(p.id)).map((p) => p.name);
      errors.push(`Already booked for this time: ${names.join(', ')}.`);
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
        { [f.pet]: petId },
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

// --- creation (spec 4.1) ------------------------------------------

export async function createBookings(payload) {
  await validateBooking(payload);

  const f = B.fields;
  const groupId = newGroupId();

  const shared = {
    [f.start]: payload.start.toISOString(),
    [f.end]: payload.end.toISOString(),
    [f.status]: B.newStatus,
    [f.account]: payload.account.id,
  };
  if (f.service && payload.service) shared[f.service] = payload.service;
  if (f.notes) shared[f.notes] = payload.notes || '';
  if (f.location) shared[f.location] = payload.location || B.defaultLocation || '';
  if (f.group) shared[f.group] = groupId;

  const created = [];
  const failed = [];

  // Sequential: clearer partial-failure reporting and gentler on rate limits.
  for (const pet of payload.pets) {
    try {
      const res = await api.post(modulePath, {
        ...shared,
        [f.title]: bookingTitle(payload, pet),
        [f.pet]: pet.id,
      });
      created.push({ id: res?.id ?? null, petId: pet.id, petName: pet.name });
    } catch (err) {
      failed.push({ petId: pet.id, petName: pet.name, error: err.message });
    }
  }

  if (created.length === 0) {
    throw new Error(`Could not create bookings: ${failed[0]?.error || 'unknown error'}`);
  }

  return { groupId, created, failed };
}
