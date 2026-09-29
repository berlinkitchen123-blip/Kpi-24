# City P&L Control Center

Expense and KPI control for City Managers. Multi-city from day one (every record is under `cities/{cityId}`).

## Run locally

```bash
npm install
cp .env.example .env.local   # fill with the Firebase web config, or leave empty for demo mode
npm run dev
```

Empty config = **demo mode** with in-memory sample data and a role picker.

## First-time Firebase setup (on your computer)

1. New Firebase project → enable Firestore (region `europe-west3`), Authentication (Email/Password + Google), Storage. Switch to Blaze plan for Cloud Functions.
2. Put the project id in `.firebaserc`.
3. Download a service account key → keep it on your computer only (it is git-ignored).
4. `cd functions && npm install && cd ..`
5. `GOOGLE_APPLICATION_CREDENTIALS=~/keys/city-pl.json node scripts/bootstrap.mjs you@company.com essen Essen`

## Deploy

Push to `main`. `.github/workflows/deploy.yml` builds and deploys hosting, Firestore/Storage rules and functions.
Set the secret `FIREBASE_SERVICE_ACCOUNT` and the variables listed at the top of the workflow in GitHub first.

## What is built (Phases 1–3)

- Front screen: to-do list first (done / snooze / reopen / add), approval + missing-receipt alerts, then KPIs
- Quick Add (phone-first): amount, category, type, vehicle, supplier, date, VAT, payment, receipt photo (compressed), note; "Saved: EUR 62.40, Fuel, Van 2, 24 Sep" with Undo
- Expenses: month, category, search, missing-receipt and pending filters, sorting, CSV export, detail drawer with edit / approve / delete + undo
- Suppliers: spend per supplier (1 / 3 / 6 months), month-on-month change, click-through to bills
- Budgets & revenue per month (copy last month), dishes sold, planned food cost
- KPIs, calculated live: cost per dish (total + per category), labour %, temporary food %, electricity and non-food per dish, margin, month-end forecast, 6-month trends, drill-down to bills
- Approvals: staff spend above the limit (Settings) waits for the City Manager
- Offline: Firestore local cache, entries sync when the connection is back

## Tests

```bash
npm run build:preview && python3 tests/e2e.py   # clicks every button in all 3 roles, desktop + phone
```

## Structure

```
src/features     tasks, dashboard, settings, expenses, budgets, kpi, fuel, approvals, reports
src/components   layout, nav, ui primitives (shadcn-style)
src/lib          firebase config, data layer (firebase + demo), formatting
src/hooks        auth/roles, live data subscriptions
src/types        domain types
functions        setUserRole (+ recurring, alerts, month-close, kpi-calc to come)
inbox/           chat-entry drop folder (Phase 2)
```

## Roles (per city, enforced in `firestore.rules`)

| Role | Can |
|---|---|
| manager | everything in that city |
| staff | add expenses/fuel, see only own entries |
| management | read-only dashboard, KPIs, reports |
