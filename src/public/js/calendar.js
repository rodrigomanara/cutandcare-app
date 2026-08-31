// FullCalendar setup. Loads bookings for the visible range from SugarCRM,
// colour-codes them by status, and opens the booking modal on slot select /
// event click.
//
// FullCalendar is loaded as a global from vendor/fullcalendar/index.global.min.js
// (see index.html), so `FullCalendar` is available without an import.

import { listBookings } from './bookings.js';
import { openBookingModal } from './booking-modal.js';
import { config } from './config.js';
import { toast } from './ui.js';
import { can } from './acl.js';
import { store } from './store.js';

export function mountCalendar(el) {
  const canCreate = can('create');

  const calendar = new FullCalendar.Calendar(el, {
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay',
    },
    buttonText: { today: 'Today', month: 'Month', week: 'Week', day: 'Day' },
    firstDay: 1,
    height: '100%',
    expandRows: true,
    nowIndicator: true,
    dayMaxEvents: true,
    selectable: canCreate,
    selectMirror: canCreate,
    initialView: store.get().calendarView || 'dayGridMonth',
    datesSet: (info) => store.set({ calendarView: info.view.type }),
    slotMinTime: '07:00:00',
    slotMaxTime: '20:00:00',
    scrollTime: '08:00:00',

    events: (fetchInfo, success, failure) => {
      listBookings({ startStr: fetchInfo.startStr, endStr: fetchInfo.endStr })
        .then(success)
        .catch((err) => {
          failure(err);
          toast(err.message || 'Could not load bookings.', 'error');
        });
    },

    // Click a day / drag a time range -> create.
    select: (info) => {
      calendar.unselect();
      if (!can('create')) {
        toast('You do not have permission to create bookings.', 'error');
        return;
      }
      openBookingModal({
        mode: 'create',
        start: info.start,
        end: info.end,
        allDay: info.allDay,
        onSaved: () => calendar.refetchEvents(),
      });
    },

    // Click an existing booking -> detail view / edit / delete.
    eventClick: (info) => {
      info.jsEvent.preventDefault();
      openBookingModal({
        mode: 'view',
        event: info.event,
        onSaved: () => calendar.refetchEvents(),
      });
    },
  });

  calendar.render();

  // Keep a legend in sync with the configured status colours.
  renderLegend(el);

  return calendar;
}

function renderLegend(calendarEl) {
  const host = document.getElementById('calendar-legend');
  if (!host) return;
  const entries = {
    ...config.bookings.statusColors,
    other: config.bookings.statusColorDefault,
  };
  host.innerHTML = Object.entries(entries)
    .map(
      ([label, color]) =>
        `<span class="legend-item"><i style="background:${color}"></i>${
          label.charAt(0).toUpperCase() + label.slice(1)
        }</span>`,
    )
    .join('');
  void calendarEl;
}
