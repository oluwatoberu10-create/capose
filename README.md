# Aurum Motors — dealership inventory, sales & CRM platform

A web platform for a Nigerian car dealership: public inventory with search and filters, no-account ordering,
a checkout prepared for future payment providers, an agent referral program (10% of profit), and a private
admin panel with inventory, orders, customers, CRM/finance, reports and commissions.

> **Placeholders:** “Aurum Motors”, the phone/WhatsApp/email/address and the legal pages are placeholders.
> Change them in **Admin → Settings** and have the privacy/terms text reviewed before launch.
> Demo car photos are from Unsplash (free licence); replace them with your own photos.

## Run it locally

Needs Node 22+. No Docker: a real Postgres 18 runs from `node_modules` on port **54335**.

```bash
npm install
npm run dev            # starts Postgres, applies migrations, runs Next.js on :3000
npm run demo:seed      # optional: 16 cars, ~11 months of sales/expenses, 3 agents, orders
npm run admin:create -- you@yourdealership.com "Your Name" owner   # prints a password once
```

`npm run preview` runs an optimised production build instead of `next dev`.

### Demo logins (created by `demo:seed`, flagged as demo)

| Role | Email | Password |
|---|---|---|
| Owner admin (only if no admin exists yet) | `admin@aurum-demo.test` | `AurumDemo!2026` |
| Approved agent | `ada@aurum-demo.test` | `AgentDemo!2026` |

Remove all demo data with **Admin → Settings → Remove demo data** or `npm run demo:remove`.
The demo admin login is kept until a real owner account exists, so you can't lock yourself out.

## Checks

```bash
npm test                    # 21 unit tests: money rules, commission, availability, formatting
npm run test:integration    # 15 tests on a throwaway aurum_test database (orders, referrals, stock, sales, payouts, finance totals)
npm run build && npm start  # then, in another terminal:
E2E_BASE=http://localhost:3000 npm run test:e2e   # 67 HTTP access-control & smoke checks (needs demo data)
```

## How it is built

- **Next.js 15 (App Router) + TypeScript + Tailwind 4**, Drizzle ORM on PostgreSQL, Zod validation, Recharts.
- **Auth:** own scrypt password hashing and database sessions (httpOnly cookie). Roles are re-read from the
  database on every request, so suspending someone takes effect immediately.
- **Roles:** Owner (everything) · Manager (everything except admin accounts) · Sales staff (inventory, orders,
  customers, enquiries — never costs, profit, CRM finance or commissions) · Agent (own dashboard only).
- **Why no Supabase/RLS:** Supabase needs RLS because browsers query its database directly. Here the browser never
  touches the database: every query runs in server code behind `requireAdmin(permission)` / `requireAgent()`, and
  public pages select from a column list that contains no cost fields. Sales staff never receive cost figures, not
  even in the page payload. The e2e suite verifies all of this over HTTP.
- **Files:** vehicle photos go to `.uploads/public` (served at `/media/…`); expense receipts go to `.uploads/private`
  and are served only to finance admins. File types are checked by content, not by name. On a host without a
  persistent disk (e.g. Vercel), swap `src/server/storage.ts` for Supabase Storage, S3 or Vercel Blob.

## Money rules (single source: `src/lib/finance.ts`)

- All amounts are whole Naira in BIGINT columns and are shown as `₦45,000,000`.
- **Total acquisition cost** = purchase price + all acquisition expenses (transport, customs, repairs, other).
- **Sale amount** = selling price − discount + additional income.
- **Net vehicle profit** = sale amount − acquisition cost of the unit − that sale's own expenses.
- **Agent commission** = 10% × net vehicle profit; none if profit ≤ 0. Created as *Pending*; it can only be
  *Approved* once the sale is fully paid and has an acquisition cost; it is *Paid* only when you record a payout.
  A payout is booked automatically as one “Agent commissions” expense.
- **Period net profit** = Σ net vehicle profit of sales in the period − operating expenses in the period.
- **No double counting:** acquisition costs reach profit once, through each sale. “Vehicle purchase costs” on the
  dashboard shows stock bought in the period but isn't deducted again. The expense form warns when a category
  looks like an acquisition cost.

## Online payments

Disabled on purpose. Orders are saved as payment *Pending* / status *Pending confirmation*, and only an admin can
mark them paid. To add Paystack or Flutterwave, implement a provider in `src/server/payments/index.ts`
(initialise + verify webhook, keys from environment variables only), add a webhook route that sets
`orders.payment_status` and `payment_reference`, and enable it. The checkout already lists providers from there.

## Deploying

Works with any Postgres (Neon, Supabase Postgres, RDS). Set `DATABASE_URL` and `APP_URL`; `npm run vercel-build`
applies migrations before building. Configure persistent file storage first (see *Files* above).
