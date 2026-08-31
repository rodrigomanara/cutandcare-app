// Dropdown (enum) option loader.
//
// SugarCRM exposes a field's dropdown as an ordered { key: label } map at
// GET /rest/v11/<module>/enum/<field>. Results are cached for the session.

import { api } from './api.js';

const cache = new Map();

export async function getEnumOptions(module, field) {
  const key = `${module}/${field}`;
  if (cache.has(key)) return cache.get(key);

  const promise = api
    .get(`${encodeURIComponent(module)}/enum/${encodeURIComponent(field)}`)
    .then((res) => res || {})
    .catch(() => ({}));

  cache.set(key, promise);
  return promise;
}

// [{ value, label }] with blank keys dropped, order preserved.
export async function getEnumList(module, field) {
  const options = await getEnumOptions(module, field);
  return Object.entries(options)
    .filter(([value]) => value !== '')
    .map(([value, label]) => ({ value, label: label || value }));
}
