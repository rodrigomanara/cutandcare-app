// Role-based access control (spec 6.2).
//
// SugarCRM exposes the signed-in user's effective ACL for a module via the
// metadata API. We fetch it once at boot and gate the create / edit / delete
// UI on it. The server still enforces ACLs on every write — this only avoids
// showing actions that will fail.

import { api } from './api.js';
import { config } from './config.js';
import { store } from './store.js';

// SugarCRM ACL values: 'yes' / 'no', booleans, or access-level numbers
// (90 = all, 75 = owner, lower = none/disabled).
function allowed(value) {
  if (value === 'yes' || value === true) return true;
  if (value === 'no' || value === false || value == null) return false;
  if (typeof value === 'number') return value >= 75; // owner-level or above
  return true; // unknown token — be permissive, the server still checks
}

const DEFAULT_ACL = { access: true, view: true, list: true, create: true, edit: true, delete: true };

export async function loadAcl() {
  const module = config.bookings.module;
  try {
    const res = await api.get(
      `metadata?type_filter=modules&module_filter=${encodeURIComponent(module)}`,
    );
    const raw = res?.modules?.[module]?.acl;
    if (!raw || typeof raw !== 'object') {
      store.set({ acl: { ...DEFAULT_ACL } });
      return store.get().acl;
    }
    const acl = {
      access: allowed(raw.access),
      view: allowed(raw.view ?? raw.read),
      list: allowed(raw.list),
      create: allowed(raw.create),
      edit: allowed(raw.edit ?? raw.write),
      delete: allowed(raw.delete),
    };
    store.set({ acl });
    return acl;
  } catch {
    // Metadata unreachable — assume allowed; writes still get server-checked.
    store.set({ acl: { ...DEFAULT_ACL } });
    return store.get().acl;
  }
}

export function can(action) {
  const acl = store.get().acl;
  if (!acl) return true; // not loaded yet — don't block
  return acl[action] !== false;
}
