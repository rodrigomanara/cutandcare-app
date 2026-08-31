# Cut & Care Bookings — webapp

Vanilla-JS (ES modules, no build step) frontend for the SugarCRM booking system.
The browser talks to SugarCRM's REST API directly; there is no backend of our own.

## Phase 1 — Authentication & session management (done)

| File | Role |
| --- | --- |
| `js/config.js` | SugarCRM URL, API version, OAuth2 client, refresh lead time |
| `js/auth.js` | password-grant login, token store (sessionStorage), proactive refresh, logout |
| `js/api.js` | REST client — attaches token, retries 429/5xx, refresh-and-retry on 401 |
| `js/session.js` | `requireAuth()` / `redirectIfAuthenticated()` route guards |
| `js/ui.js` | toast + button busy-state helpers |
| `js/pages/login.js` | login form controller |
| `js/pages/app.js` | authenticated shell (calls `/me`, logout, mounts the calendar) |
| `login.html` / `index.html` | the two pages |

### Session model

- **Storage:** `sessionStorage` key `ccb.session` — `{ accessToken, refreshToken, expiresAt, refreshExpiresAt }`.
  HttpOnly cookies aren't an option without a backend; sessionStorage keeps the
  token off persistent disk and scoped to the tab.
- **Refresh:** a timer fires `config.refreshLeadTimeMs` (5 min) before the access
  token expires and calls the SugarCRM `refresh_token` grant. `visibilitychange`
  and `online` re-arm the timer so a throttled mobile tab catches up on return.
- **Recovery:** if the refresh token is expired/rejected, the session is cleared
  and the user is sent to `login.html?expired=1`. A 401 on any API call triggers
  one refresh-and-retry before giving up the same way.
- **Persistence across reloads:** guards read `sessionStorage` on every page load;
  `index.html` redirects to login when unauthenticated, `login.html` redirects to
  the app when already authenticated (honouring a safe `?next=`).

## Phase 2 — Calendar interface (done)

| File | Role |
| --- | --- |
| `vendor/fullcalendar/index.global.min.js` | FullCalendar 6.1.15 standard bundle, vendored (no CDN, no build) |
| `js/calendar.js` | mounts FullCalendar (month/week/day), loads events, opens the modal |
| `js/bookings.js` | reads `config.bookings.module` via the SugarCRM filter API, maps records → events |
| `js/datetime.js` | date/time + slot formatting helpers |
| `js/modal.js` | generic `<dialog>`-based modal |
| `js/booking-modal.js` | create / view modal opened from the calendar (form body is filled in Phase 3–5) |

- **Views:** `dayGridMonth` (default), `timeGridWeek`, `timeGridDay`; week starts Monday, time grid 07:00–20:00.
- **Event loading:** on every range change `listBookings()` POSTs to
  `{module}/filter` with `date_start` between the visible range, paging on
  `next_offset` up to `config.bookings.pageSize`.
- **Colour coding:** `config.bookings.statusColors` maps a status value to a
  colour; unknown statuses use `statusColorDefault`. A legend above the calendar
  is generated from the same map.
- **Creating:** clicking a day or dragging a time range opens the "New booking"
  modal with the slot pre-filled. Clicking an existing event opens a read-only
  view. The modal bodies are placeholders until Phase 3 (form) and Phase 5
  (edit/delete).

### Bookings module configuration

`config.bookings` in `js/config.js` — set these for the target instance:

```js
bookings: {
  module: 'cnc_Bookings',                 // SugarCRM custom module API name
  fields: { start, end, title, status, account, pet },  // field API names
  statusColors: { pending, confirmed, completed },      // status key → colour
  statusColorDefault: '#1f6feb',
  pageSize: 200,
}
```

## Phase 3 — Booking form & account/pet data (done)

| File | Role |
| --- | --- |
| `js/booking-form.js` | the form body: editable date/time, account picker, account panel, pet checklist, service, notes |
| `js/combobox.js` | reusable searchable single-select (ARIA combobox, debounced async search) |
| `js/accounts.js` | account prefix search, detail fetch, related contacts |
| `js/pets.js` | pets for an account (via relationship link, or a fallback filter), age-from-DOB |
| `js/enums.js` | `GET {module}/enum/{field}` dropdown loader with session cache |

- **Form (3.1):** opened from a calendar slot. Date + start/end time are
  pre-filled from the click and editable. Submit is disabled until an account
  and at least one pet are chosen and the times are valid.
- **Account (3.2):** the picker searches `Accounts` by name prefix; selecting one
  loads a read-only panel with phone / email / billing address and the related
  contacts (name, title, phone, email).
- **Pets (3.3):** selecting an account loads its pets as a checkbox list showing
  name, breed, age (derived from DOB), allergies and health notes. Inactive pets
  are shown disabled.
- The form produces a normalised payload (`account`, `pets[]`, `service`,
  `notes`, `start`, `end`). **Persisting it is Phase 4** — for now submit logs the
  payload and shows a toast. Event view (click an existing booking) is still the
  Phase 2 read-only stub until Phase 5.

### Accounts / Pets configuration

`config.accounts` and `config.pets` in `js/config.js`:

```js
accounts: { module: 'Accounts', searchField: 'name',
            fields: { name, phone, email, street, city, state, postalcode, country, status },
            contactsLink: 'contacts', contactFields: {...} },
pets: { module: 'cnc_Pets',
        accountLink: 'cnc_pets_accounts',   // Accounts→Pets relationship link name
        fields: { account, name, breed, dob, healthNotes, allergies, status } },
```

Set `pets.accountLink` to the real relationship name, or `null` to fall back to
filtering the pets module where `fields.account` equals the account id. Add the
service-type field to `config.bookings.fields.service` (options are fetched from
its enum unless `config.bookings.serviceOptions` is set).

## Phase 4 — Multi-pet booking generation & validation (done)

| File | Role |
| --- | --- |
| `js/booking-save.js` | `validateBooking()` + `createBookings()` — one record per pet, shared group id |

- **Generation (4.1):** on submit, `createBookings(payload)` creates one record in
  `config.bookings.module` per selected pet. All records share the slot, service,
  notes, location and a generated group id (`config.bookings.fields.group`, if
  set); each is linked to its own pet via `config.bookings.fields.pet`. Records
  are created sequentially; a partial failure is reported (created N of M).
- **Validation (4.2):**
  - start must be in the future; end after start;
  - an account and at least one pet must be selected;
  - the account must be active (`config.accounts.fields.status` not in
    `inactiveValues`) — inactive pets are already unselectable in the form;
  - **no double-booking:** per pet, the module is queried for an overlapping
    booking whose status is not in `config.bookings.freeingStatuses`; any hit
    blocks the submit and names the pet.
  - Failures are shown as a list in the form; nothing is created if validation
    fails.

### Grouping & location — optional custom fields

`config.bookings.fields.group` and `.location` are empty by default. Set them to
real text-field API names on the bookings module to persist the shared group id
and location (a Location input then appears in the form). Left empty, the group
id is still generated and returned to the UI but not stored.

## Phase 5 — Booking management / CRUD (done)

| File | Role |
| --- | --- |
| `js/booking-detail.js` | read view + edit/delete actions, opened by clicking a calendar event |
| `js/booking-edit-form.js` | edit form — date/time, status, service, notes, optional "apply to group" |
| `js/bookings.js` (extended) | `updateBooking`, `deleteBooking`, `listGroupMembers`, `updateBookingGroup`, `deleteBookingGroup`, `getBookingAudit`, `isBookingLocked` |
| `js/modal.js` (extended) | `confirmDialog()` promise-based confirmation |

- **Read (5.2):** clicking an event loads the full record and resolves the
  linked account (name, phone, email) and pet (name, breed). Shows status
  (coloured), service, notes, and a collapsible **History** panel from
  `GET {module}/{id}/audit` (silently hidden if the audit API is unavailable).
  Group members are listed when the booking has a group id.
- **Update (5.3):** Edit changes date/time, status, service and notes. Account
  and pet are fixed. Bookings whose status is in `config.bookings.lockedStatuses`
  (default `['completed']`) show as read-only — the Edit button is disabled. For
  a grouped booking, a checkbox applies the same changes to every record in the
  group.
- **Delete (5.4):** always confirmed. Grouped bookings prompt "this one only" vs
  "all N". `config.bookings.deleteMode: 'soft'` archives instead (sets status to
  `config.bookings.archiveStatus`) for an audit trail; `'hard'` issues DELETE.
- **Create (5.1):** Phase 4 already refetches the calendar on success.

## Phase 6 — Technical requirements (done, with caveats)

| File | Role |
| --- | --- |
| `js/activity.js` | in-flight request counter + 120-entry API call log (`window.ccbApiLog()`) |
| `js/store.js` | tiny observable store — `user`, `acl`, `calendarView` |
| `js/acl.js` | loads the bookings-module ACL from the SugarCRM metadata API; `can(action)` |
| `js/ui.js` (extended) | `mountProgressBar()` — top bar driven by request activity |

- **6.1 API integration:** v11 (configurable); `apiFetch` retries network / 429 /
  5xx with exponential backoff and honours `Retry-After`; one refresh-and-retry
  on 401; every call is console-logged (`config.debug`) and pushed to an
  in-memory ring buffer readable via `window.ccbApiLog()`.
- **6.2 Security — RBAC:** at boot the app reads the signed-in user's effective
  ACL for the bookings module and hides Create (calendar not selectable),
  Edit and Delete accordingly. The server still enforces ACLs on every write —
  this only avoids offering doomed actions.
- **6.2 Security — CORS / secrets / server validation:** see "Security &
  deployment" below. These items depend on infrastructure, not this codebase.
- **6.3 State management:** `store.js` is the single source of truth for
  app-wide state. Modal/form state stays component-local by design.
- **6.4 UI/UX:** responsive throughout; a top progress bar reflects any
  in-flight request; button spinners (`setBusy`); toasts (`toast`); destructive
  actions always go through `confirmDialog`.

## Security & deployment

The "frontend-only, browser talks to SugarCRM directly" design (a deliberate
project choice) has consequences that must be handled at deploy time:

- **No API keys in the client** — there are none. The only credential is the
  per-user OAuth2 token, held in `sessionStorage` (HttpOnly cookies need a
  backend we don't have). It is cleared on logout / tab close / refresh failure.
- **CORS:** SugarCRM must return `Access-Control-Allow-Origin` for the origin
  this app is served from, plus `Access-Control-Allow-Headers: OAuth-Token,
  Content-Type` and the used methods. Configure this on SugarCRM
  (`http.response_headers`) or a reverse proxy in front of it. If that is not
  acceptable, put a thin same-origin proxy in front and point `sugarBaseUrl` at
  it — no app code changes needed.
- **Input validation:** client-side checks (Phase 4) are UX only. SugarCRM's
  business logic / field validation is the authority; do not disable it.
- **Serve over HTTPS** so `sessionStorage`, the token, and `crypto.randomUUID`
  behave (the latter needs a secure context).

## Configuring

Edit `js/config.js`:

```js
sugarBaseUrl: 'https://your-sugar-instance.com',
platform: 'cutandcare',   // register this in Admin > Configure API Platforms
```

Register the custom platform in SugarCRM so signing in here does not evict the
user's regular web session (platform `base`). The built-in `sugar` OAuth2 client
has an empty secret and is safe to ship to the browser.

Dev override without editing the file: in the browser console,
`localStorage.SUGAR_BASE_URL = 'https://other-instance.com'`.

## Running

Any static file server pointed at this directory. With the repo's nginx setup
(docroot `src/`) it is served at `/public/`. Quick local check:

```bash
cd src/public && python3 -m http.server 8000
# open http://localhost:8000/login.html
```

SugarCRM must send CORS headers permitting this origin (Admin > System Settings,
or `http.response_headers` / a reverse proxy) for the browser calls to succeed.
