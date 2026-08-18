# TeziPOS Frontend

React (Vite) single-page app for TeziPOS — the till, admin dashboard, and
reporting UI for a unified butchery/gas-refill POS with offline-first
sales, multi-location support, corporate accounts, loyalty, and promotions.

See `../AGENTS.md` for cross-cutting notes shared with the backend repo.

## Stack

- React 18 + Vite
- Tailwind CSS + CSS-variable theming (dark/light toggle)
- IndexedDB (via a small hand-rolled wrapper) for offline-first sales/catalog
  caching and a sync queue
- No router library — path-based navigation is handled manually in `App.jsx`
- `xlsx` (dynamically imported) for Excel export on the Reports page

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173, proxies /api to the backend
```

The dev server proxies `/api/*` to `http://127.0.0.1:4000` (see
`vite.config.js`), so run the backend locally on port 4000 alongside this.
`server.host = true` is set so it's also reachable from another device on
the same network (e.g. testing on a tablet/till) via your machine's LAN IP.

```bash
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

## Configuration

No `.env` file is required for local dev (the Vite proxy handles API
routing). For a production build, or to point at a backend that isn't on
`localhost:4000` (e.g. testing against a deployed backend), copy
`.env.example` to `.env.local` (or `.env.production.local`) and set:

```
VITE_API_BASE=https://your-backend-host/api
```

`src/lib/api.js` falls back to the dev proxy path (`/api`) or
`<host>:4000/api` if this isn't set — the latter fallback is unlikely to be
correct for a real deployment, so set this explicitly when building for
production.

## Project structure

```
src/
  pages/            Route-level screens (Till, Reports, StaffAdmin, ...)
  components/        Reusable UI (Cart, Payment, ProductCatalog, modals, ...)
  layouts/           RoleNav (role-based nav + shop switcher)
  contexts/          CartContext, LocationContext (active shop for admin/supervisor)
  lib/
    api.js            All backend HTTP calls
    saleOperations.js  Thin wrappers around the local sale queue
    settings.js        Local settings (offline sales toggle, etc.)
    useTheme.js         Dark/light theme hook
    auth/               Offline PIN fallback / credential caching
    cache/              IndexedDB-backed product/customer caches
    db/
      indexedDb.js       Low-level IndexedDB helpers
      syncQueue.js        Local sale queue + sync-to-server logic
      offlineQueue.js     Generic offline write queue
  styles/            Tailwind entry + per-feature CSS (till, cart, payment, ...)
```

## Roles & navigation

Navigation is role-driven (`layouts/RoleNav.jsx`):

- **Cashier** — Till only.
- **Supervisor** — Till, Overrides (credit/discount approvals), Catalog. Can
  also see the shop switcher if granted `can_switch_location`.
- **Admin** — full nav (Dashboard, Till, Reports, Customers, Staff, Catalog,
  Rewards, Promotions, Corporate, Settings) and always has the shop
  switcher.

The **shop switcher** (`contexts/LocationContext.jsx`) lets an admin (or a
permitted supervisor) view another location's stock/reports, and lets an
admin ring up a sale attributed to that shop from a single login. Switching
shops triggers a full page reload so every page refetches cleanly for the
newly selected location.

## Offline-first sales

- All sales are written to IndexedDB first (`lib/db/syncQueue.js`), then
  synced to the backend — this happens whether the till is online or
  offline, so the same code path is exercised either way.
- A background interval in `App.jsx` retries pending syncs every 10s and
  on the browser's `online` event.
- Product/cylinder-brand stock is only decremented on the **server** at
  sync time; the till's `ProductCatalog` listens for a `tezipos:sales-synced`
  window event to refetch and show updated quantities once a background
  sync actually lands (not just immediately after checkout, which would
  still show pre-sync numbers for a sale that hasn't synced yet).
- Toggle "Offline sales" in the Till header to force local-only queueing
  even while online (useful for testing) - eliminated after testing completed.

## Verification

```bash
npm run build
```

There's no frontend test suite yet — `npm run build` (and manually running
through Till → checkout → Reports) is the current smoke test. Backend
changes have unit tests; see `../backend/README.md`.

## Notes for future work

- `TeziPOS_Build_Plan.md` and the `TeziPOS_*_Status.md` files at the repo
  root track the phased build plan and what's done vs. outstanding.
