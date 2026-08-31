// Pets data layer — the animals belonging to the selected account, shown as a
// multi-select checklist in the booking form.

import { api } from './api.js';
import { config } from './config.js';

const P = config.pets;
const modulePath = encodeURIComponent(P.module);

function petFields() {
  const f = P.fields;
  return [f.name, f.breed, f.dob, f.healthNotes, f.allergies, f.status, f.account]
    .filter(Boolean)
    .join(',');
}

// Rough age in years/months from a DOB string, or null.
export function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`;
}

function toPet(rec) {
  const f = P.fields;
  return {
    id: rec.id,
    name: rec[f.name] || '(unnamed)',
    breed: rec[f.breed] || '',
    dob: rec[f.dob] || '',
    age: ageFromDob(rec[f.dob]),
    healthNotes: rec[f.healthNotes] || '',
    allergies: rec[f.allergies] || '',
    status: f.status ? rec[f.status] ?? null : null,
    active: isPetActive(rec[f.status]),
    record: rec,
  };
}

function isPetActive(status) {
  const f = P.fields;
  if (!f.status || !f.inactiveValues?.length) return true;
  return !f.inactiveValues.includes(status);
}

export async function listPetsForAccount(accountId) {
  if (!accountId) return [];
  const fields = petFields();

  // Preferred path: the Accounts -> Pets relationship link.
  if (P.accountLink) {
    const res = await api.get(
      `${encodeURIComponent(config.accounts.module)}/${encodeURIComponent(accountId)}` +
        `/link/${encodeURIComponent(P.accountLink)}?fields=${encodeURIComponent(fields)}` +
        `&max_num=${P.pageSize}&order_by=${encodeURIComponent(P.fields.name)}:asc`,
    );
    return (res?.records ?? []).map(toPet);
  }

  // Fallback: filter the pets module by an account id field.
  const res = await api.post(`${modulePath}/filter`, {
    filter: [{ [P.fields.account]: accountId }],
    fields,
    max_num: P.pageSize,
    order_by: `${P.fields.name}:asc`,
  });
  return (res?.records ?? []).map(toPet);
}

export function getPet(id) {
  return api
    .get(`${modulePath}/${encodeURIComponent(id)}?fields=${encodeURIComponent(petFields())}`)
    .then(toPet);
}
