// SugarCRM connection settings for the booking webapp.
//
// This file is the single place to point the app at a SugarCRM instance.
// It ships to the browser as-is, so it must never contain a client secret
// for a confidential OAuth2 client — only the public "sugar" password client.

export const config = {
  // Base URL of the SugarCRM instance. No trailing slash, no /rest/... suffix.
  sugarBaseUrl: '/backend',

  // REST API version segment (v10 / v11 / v11_x). Phase spec targets v11+.
  apiVersion: 'v11_26',

  // OAuth2 client. "sugar" is SugarCRM's built-in first-party password client
  // and has an empty secret. Only change this if an admin registered a
  // dedicated client for this app.
  clientId: 'sugar',
  clientSecret: '',

  // Platform string sent with every token request. Register a matching custom
  // platform in Sugar (Admin > Configure API Platforms) so signing in here does
  // NOT evict the user's regular web session (which uses platform "base").
  platform: 'cutandcare',

  // Refresh the access token this many milliseconds before it expires.
  refreshLeadTimeMs: 5 * 60 * 1000,

  // Transient-failure retry policy (network / 429 / 5xx).
  maxRetries: 3,

  // Log every REST call to the console for debugging.
  debug: true,

  // --- Bookings module -------------------------------------------------
  // The custom SugarCRM module that stores bookings, plus the mapping from
  // its fields to the ones the calendar needs. Fill in the real module API
  // name and field names for the target instance.
  bookings: {
    module: 'GR_Booking',

    fields: {
      // Datetime the booking starts / ends (SugarCRM `datetime` fields).
      start: 'booking_start_time_c',
      end: 'booking_end_time_c',
      // Short label shown on the calendar event.
      title: 'name',
      // Status dropdown driving the event colour.
      status: 'booking_status_c',
      // Service / booking type dropdown.
      service: 'service_type_c',
      // Free-text notes / special instructions.
      notes: 'description',
      // Datetime the booking is booked for — set to the booking's start
      // datetime on create (same value as `start`).
      bookingDateTime: 'booking_date_time_c',
      // Reminder fields written on create: a boolean "send a reminder" flag and
      // the lead time in hours before the booking (see reminderLeadHours).
      sendReminder: 'send_booking_reminder_c',
      reminderIn: 'reminder_in_c',
      // Relate fields read back from a booking record (populated by Sugar once
      // the relationship link below is set). Used by the detail/read views.
      account: 'accounts_gr_booking_1_name',
      pet: 'gr_pet_gr_booking_1_name',
      // Relate id field for the pet link (Sugar's deterministic name for the
      // `gr_pet_gr_booking_1` relationship). Used only to filter the
      // double-booking check by pet; the check fails open if this is wrong.
      petId: 'gr_pet_gr_booking_1gr_pet_ida',
      // Duration of the (per-pet) booking, in hours (e.g. 2.5).
      booking_length: 'booking_length_c',
      // Optional: a text field that holds a shared id across the records
      // generated from one multi-pet submit. Leave '' to disable grouping
      // (the group id is still returned to the UI, just not persisted).
      group: '',
      // Optional: a field for the shared booking location.
      location: '',
    },

    // SugarCRM relationship link names used to link a new booking to its
    // account and pet. Setting a relate `_name` field on create does NOT link
    // the records — the app POSTs to `{module}/{id}/link` with these names
    // instead. Both are one-to-many (Account / Pet is the "one" side).
    links: {
      account: 'accounts_gr_booking_1',
      pet: 'gr_pet_gr_booking_1',
    },

    // Status assigned to a newly created booking (a `booking_status_c`
    // dropdown key — must match Sugar exactly).
    newStatus: 'Reserved',

    // Lead time (hours) written to `reminderIn` on create.
    reminderLeadHours: 8,

    // Default location written to new bookings when the form has no value
    // (only used if fields.location is set).
    defaultLocation: '',

    // Statuses that no longer occupy the slot, so they are ignored by the
    // double-booking check.
    freeingStatuses: ['completed', 'cancelled'],

    // Statuses that lock a booking against editing (Phase 5.3).
    lockedStatuses: ['completed'],

    // Delete behaviour (Phase 5.4): 'hard' issues DELETE; 'soft' keeps the
    // record and sets its status to `archiveStatus` for the audit trail.
    deleteMode: 'hard',
    archiveStatus: 'cancelled',

    // Default booking length (minutes) when the calendar click has no end.
    defaultDurationMin: 60,

    // Service-type dropdown options as { key: label }. Leave null to fetch them
    // live from `GET {module}/enum/{service field}`.
    serviceOptions: null,

    // Booking status value -> event colour. Keys must match the module's
    // status dropdown option keys exactly. Anything not listed falls back
    // to `statusColorDefault`.
    // NOTE: only `Reserved` is a confirmed `booking_status_c` key so far — the
    // rest below (and freeingStatuses / lockedStatuses / archiveStatus) are
    // placeholders until the real dropdown values are known.
    statusColors: {
      Reserved: '#d29922',
      confirmed: '#1a7f37',
      completed: '#6e7781',
    },
    statusColorDefault: '#1f6feb',

    // Page size when fetching bookings for a visible date range.
    pageSize: 200,
  },

  // --- Accounts (stock module) --------------------------------------
  accounts: {
    module: 'Accounts',
    // Field the searchable picker matches against (prefix match).
    searchField: 'name',
    fields: {
      name: 'name',
      phone: 'phone_office',
      email: 'email1',
      street: 'billing_address_street',
      city: 'billing_address_city',
      state: 'billing_address_state',
      postalcode: 'billing_address_postalcode',
      country: 'billing_address_country',
      // Used in Phase 4 to block bookings against inactive customers.
      status: '',
      inactiveValues: [],
    },
    // Relationship link name Accounts -> Contacts.
    contactsLink: 'contacts',
    contactFields: {
      name: 'name',
      phone: 'phone_work',
      mobile: 'phone_mobile',
      email: 'email1',
      title: 'title',
    },
    pageSize: 20,
  },

  // --- Pets / Animals module ---------------------------------------
  // Almost certainly a custom module. Fill in the real API name, the
  // Accounts->Pets relationship link name, and the field names.
  pets: {
    module: 'GR_Pet',

    // Preferred: relationship link name on the Accounts module that returns
    // this account's pets — fetched via GET /Accounts/{id}/link/{accountLink}.
    accountLink: 'accounts_gr_pet_1',
    // Fallback when accountLink is null: filter the pets module where this
    // field equals the account id.
    fields: {
      account: 'account_id',
      name: 'name',
      breed: 'breed_c',
      dob: 'dob_c',
      healthNotes: 'description',
      allergies: 'allergies_c',
      status: '',
      inactiveValues: [],
    },
    pageSize: 100,
  },
};

// Optional dev override: set localStorage.SUGAR_BASE_URL in the browser console
// to point at another instance without editing this file.
try {
  const override = localStorage.getItem('SUGAR_BASE_URL');
  if (override) config.sugarBaseUrl = override;
} catch {
  /* localStorage unavailable — ignore */
}

// Build a full REST endpoint URL from a version-relative path.
export function apiUrl(path) {
  const base = config.sugarBaseUrl.replace(/\/+$/, '');
  const clean = String(path).replace(/^\/+/, '');
  return `${base}/rest/${config.apiVersion}/${clean}`;
}
