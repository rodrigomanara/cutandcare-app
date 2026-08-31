// Minimal observable store for app-wide state.
//
// The spec asks for a state-management library; with the vanilla-JS / no-build
// constraint this is the equivalent — a single source of truth for state that
// outlives a component (the signed-in user, module permissions, calendar view).
// Transient form state stays local to its modal by design.

function createStore(initial) {
  let state = { ...initial };
  const subscribers = new Set();

  return {
    get: () => state,
    select: (fn) => fn(state),
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      for (const fn of subscribers) fn(state);
    },
    subscribe(fn) {
      subscribers.add(fn);
      fn(state);
      return () => subscribers.delete(fn);
    },
  };
}

export const store = createStore({
  user: null, // { name, id, ... } from /me
  acl: null, // module permission map from acl.js
  calendarView: 'dayGridMonth',
});
