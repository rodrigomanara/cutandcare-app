// Booking modal entry point — opened from the calendar.
//
//  - slot selected  -> "New booking" form (Phase 3) + create (Phase 4)
//  - event clicked   -> booking detail view / edit / delete (Phase 5)

import { openModal } from './modal.js';
import { renderBookingForm } from './booking-form.js';
import { createBookings } from './booking-save.js';
import { openBookingDetail } from './booking-detail.js';
import { toast } from './ui.js';

export function openBookingModal(opts) {
  if (opts.mode === 'view') {
    return openBookingDetail({ event: opts.event, onChanged: opts.onSaved });
  }
  return openCreateModal(opts);
}

function openCreateModal({ start, end, allDay, onSaved }) {
  openModal({
    title: 'New booking',
    render: (body, close) => {
      renderBookingForm(
        body,
        { start, end, allDay },
        {
          onCancel: () => close('cancel'),
          onSubmit: async (payload) => {
            const { created, failed } = await createBookings(payload);

            if (failed.length) {
              toast(
                `Created ${created.length} of ${created.length + failed.length} bookings. ` +
                  `Failed: ${failed.map((x) => x.petName).join(', ')}.`,
                'error',
                7000,
              );
            } else {
              toast(
                `Created ${created.length} booking${created.length === 1 ? '' : 's'} for ${payload.account.name}.`,
                'success',
              );
            }
            close('ok');
            onSaved?.();
          },
        },
      );
    },
  });
}
