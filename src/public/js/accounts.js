// Accounts data layer — searchable customer lookup plus the read-only detail
// (contact info + related contacts) shown in the booking form.

import { api } from './api.js';
import { config } from './config.js';

const A = config.accounts;
const modulePath = encodeURIComponent(A.module);

function detailFields() {
  const f = A.fields;
  return [f.name, f.phone, f.email, f.street, f.city, f.state, f.postalcode, f.country, f.status]
    .filter(Boolean)
    .join(',');
}

export function formatAddress(rec) {
  const f = A.fields;
  const line1 = rec[f.street];
  const line2 = [rec[f.city], rec[f.state], rec[f.postalcode]].filter(Boolean).join(' ');
  return [line1, line2, rec[f.country]].filter(Boolean).join(', ');
}

// Prefix search for the combobox. Returns [{ id, label }].
export async function searchAccounts(query) {
  const term = query.trim();
  if (!term) return [];

  const res = await api.post(`${modulePath}/filter`, {
    filter: [{ [A.searchField]: { $starts: term } }],
    fields: A.fields.name,
    max_num: A.pageSize,
    order_by: `${A.fields.name}:asc`,
  });

  return (res?.records ?? []).map((r) => ({ id: r.id, label: r[A.fields.name] || '(no name)' }));
}

export async function getAccount(id) {
  const f = A.fields;
  const rec = await api.get(
    `${modulePath}/${encodeURIComponent(id)}?fields=${encodeURIComponent(detailFields())}`,
  );
  return {
    id: rec.id,
    name: rec[f.name] || '',
    phone: rec[f.phone] || '',
    email: rec[f.email] || '',
    address: formatAddress(rec),
    status: f.status ? rec[f.status] ?? null : null,
    record: rec,
  };
}

export async function getAccountContacts(id) {
  const cf = A.contactFields;
  const fields = [cf.name, cf.phone, cf.mobile, cf.email, cf.title].filter(Boolean).join(',');
  const res = await api.get(
    `${modulePath}/${encodeURIComponent(id)}/link/${encodeURIComponent(A.contactsLink)}` +
      `?fields=${encodeURIComponent(fields)}&max_num=50&order_by=${encodeURIComponent(cf.name)}:asc`,
  );
  return (res?.records ?? []).map((r) => ({
    id: r.id,
    name: r[cf.name] || '',
    phone: r[cf.phone] || r[cf.mobile] || '',
    email: r[cf.email] || '',
    title: r[cf.title] || '',
  }));
}

// Phase 4 helper: is this account usable for a new booking?
export function isAccountActive(account) {
  const f = A.fields;
  if (!f.status || !f.inactiveValues?.length) return true;
  return !f.inactiveValues.includes(account.status);
}
