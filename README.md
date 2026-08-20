<!-- ---------------------------------------------------------------------
     The "Live demo" link below points at GitHub Pages and will 404 until
     Pages is switched on: Settings -> Pages -> deploy from main / root.
     Add a portfolio link to the byline once your portfolio site is live.
     This comment is invisible when GitHub renders the page.
     --------------------------------------------------------------------- -->

# Hotel Property Management System

A working front-office PMS for a fictional hotel: reservations, room status, housekeeping,
RFID key card issuing, and a door access audit trail. It runs entirely in the browser —
no backend, no build step, no dependencies.

**[Live demo](https://shinso56.github.io/hotel-pms-demo/)** · Built by **Khan Kassim Iddy** · [github.com/Shinso56](https://github.com/Shinso56)

---

## Why this project exists

I have built property management systems for two hotels in Iringa as freelance work, and
installed the RFID access control they run on — 17 smart locks on one rollout, plus door
addressing and audit-compliant time synchronisation.

Those systems belong to their owners and hold real guest data, so they cannot be shown.
This is a clean-room rebuild of the same ideas on invented data, so the work can actually
be clicked through.

The access control module is the part I would point at first. Most PMS demos stop at
bookings; this one models the credential lifecycle and the door log that hotel security
actually depends on.

---

## What it does

| Module | What it covers |
|---|---|
| **Dashboard** | Occupancy, arrivals, departures, in-house guests, room revenue, 14-day trend, open access alerts |
| **Reservations** | Searchable booking list, new bookings with overlap detection, check-in and check-out, per-guest folio |
| **Rooms** | Live status grid by floor and state, with per-room detail, lock ID and recent door activity |
| **Guests** | Directory with stay history and lifetime value |
| **Key cards & access** | Credential list with issue/revoke, full door audit log, automated anomaly detection |
| **Housekeeping** | Cleaning queue, out-of-order rooms, whole-property floor board |
| **Reports** | Occupancy, ADR and RevPAR over 7 / 14 / 30 days, revenue by room type, booking source mix |

### Front-office flows that actually run

- **Check in** — validates the room is clean, vacant and in service, posts room charges to the
  folio, encodes a key card bound to that room's lock, and writes the encode to the audit log.
- **Check out** — presents the itemised folio, settles it, expires the key card immediately,
  and moves the room into the cleaning queue.
- **New booking** — refuses any stay that overlaps an existing reservation for the same room.
- **Revoke card** — kills a credential mid-stay and records the reason against the door log.

### Access control rules

The audit view runs rules across the door log and surfaces what looks wrong:

- Three or more refused reads on one door in a day — the signature of someone working
  through unregistered cards.
- A card presented after it expired at checkout.
- A master credential used outside staffed hours.
- **Clock drift** — a lock whose clock has run ahead of the server, which silently corrupts
  the ordering of the audit trail. Getting this right is most of the work in a real
  deployment, and the demo lets you re-sync the lock and watch the alert clear.

---

## Running it

No install, no build, no server.

```bash
git clone https://github.com/Shinso56/hotel-pms-demo.git
```

Then open `index.html` in any browser.

The scripts are plain `<script>` tags rather than ES modules specifically so that opening
the file straight from disk works — module imports would be blocked by CORS over `file://`.

To serve it over HTTP instead:

```bash
python -m http.server 8000
```

### Single-file build

`tools/build-standalone.js` inlines the CSS and JavaScript into one self-contained HTML
file — useful for emailing the demo or hosting it as a single asset.

```bash
node tools/build-standalone.js
```

It writes `dist/kilimanjaro-view-pms.html` (a complete document, ~138 KB) and
`dist/artifact.html` (page content only, for hosts that supply their own wrapper).
Generating the bundle from source on every run means it cannot drift from the real app.

---

## How it is built

```
index.html                    markup shell: sidebar, topbar, view container
css/styles.css                design tokens, components, light/dark themes, responsive rules
js/store.js                   data model, seeded generator, persistence, queries, mutations
js/ui.js                      formatting, icons, pills, toasts, modals, SVG charts
js/views.js                   one render function per screen
js/app.js                     hash routing, delegated events, front-office flows
tools/build-standalone.js     single-file bundler
```

Vanilla JavaScript, hand-written CSS. No framework and no charting library — the bar charts
and split bars are built from styled elements.

**State** lives in `localStorage`, so changes survive a refresh. Every access is wrapped in
`try`/`catch`, so the app still runs in memory where storage is blocked. "Reset demo data"
restores the starting state.

**Seeded generation.** Sample data comes from a fixed-seed PRNG (mulberry32), so every
visitor sees the same property. Dates are generated relative to the current date and the
data re-seeds when the day rolls over, so the demo always shows arrivals and departures for
today rather than looking abandoned.

**Stay history is built room by room** rather than at random — a walk along each room's
calendar alternating vacancies and stays. That makes double bookings structurally
impossible and produces an occupancy curve that behaves like a real property (roughly
40–65%) instead of noise.

**Rendering** is string templating into `innerHTML`, with all interaction handled by one
delegated click listener keyed on `data-action`. Re-rendering a view therefore cannot leave
stale listeners behind.

**Theming** covers three states, not two: an explicit choice stamps `data-theme` on the root
element, while the default "system" setting stamps nothing and leaves only
`prefers-color-scheme` to decide. Components read colour exclusively through tokens, never
from inside a media or attribute block, so no combination renders one theme's text on the
other theme's background.

---

## On the data

**Everything in this demo is invented.** No part of it comes from a real property or a real
guest.

- Guest names are randomly assembled from name pools. Any resemblance to a real person is
  coincidental.
- Email addresses use `example.com`, the domain reserved for documentation.
- Phone numbers and identity document numbers are **stored** partially masked, not merely
  masked at display time — there is no complete number anywhere in the data to leak.

Guest names are free text, so every value rendered into HTML passes through a single
escaping helper. Markup injected through a booking form is displayed as literal text.

---

## Possible next steps

- A REST backend (Flask or Node) with PostgreSQL, replacing the `localStorage` layer
- Rate plans and seasonal pricing rather than one flat rack rate per room type
- Channel manager sync for the OTA booking sources
- Reading real lock exports (CSV) into the audit view instead of generated events
- Printable folio and registration card

---

## Licence

MIT — use any part of it.
