// Global request-activity tracking + an in-memory API call log for debugging.
//
// api.js reports here; ui.js subscribes to drive the top progress bar. Kept in
// its own module so api.js and ui.js don't import each other.

const listeners = new Set();
let inFlight = 0;

const LOG_MAX = 120;
const logBuffer = [];

export function onActivityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(inFlight);
}

export function activityStart() {
  inFlight += 1;
  if (inFlight === 1) emit();
}

export function activityEnd() {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight === 0) emit();
}

export function isBusy() {
  return inFlight > 0;
}

export function recordApiCall(entry) {
  logBuffer.push({ at: new Date().toISOString(), ...entry });
  if (logBuffer.length > LOG_MAX) logBuffer.shift();
}

export function getApiLog() {
  return logBuffer.slice();
}

// Exposed for quick inspection from the browser console.
if (typeof window !== 'undefined') {
  window.ccbApiLog = getApiLog;
}
