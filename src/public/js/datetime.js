// Small date/time formatting + parsing helpers shared by the calendar UI.

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function formatDate(d) {
  return dateFmt.format(toDate(d));
}

export function formatTime(d) {
  return timeFmt.format(toDate(d));
}

// "Sat 12 Apr 2026, 09:00 – 10:30" (or just the date for an all-day slot).
export function formatSlot(start, end, allDay = false) {
  const s = toDate(start);
  if (allDay || !end) return formatDate(s) + (allDay ? '' : `, ${formatTime(s)}`);
  const e = toDate(end);
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${formatDate(s)}, ${formatTime(s)} – ${formatTime(e)}`
    : `${formatDate(s)}, ${formatTime(s)} – ${formatDate(e)}, ${formatTime(e)}`;
}

function toDate(d) {
  return d instanceof Date ? d : new Date(d);
}

// --- <input type="date|time"> helpers (local time) --------------------

export const pad2 = (n) => String(n).padStart(2, '0');

export function toDateInput(d) {
  const x = toDate(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

export function toTimeInput(d) {
  const x = toDate(d);
  return `${pad2(x.getHours())}:${pad2(x.getMinutes())}`;
}

// Combine a "yyyy-mm-dd" + "HH:MM" pair into a local Date (Invalid Date if bad).
export function fromDateTimeInputs(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}`);
}
