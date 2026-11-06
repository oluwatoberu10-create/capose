import { Suspense } from "react";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { FinanceChart, SalesCountChart } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/filters";
import { LinkButton, Notice, ORDER_TONES, PAY_TONES, PageHeader, Section, StatCard, StatusBadge } from "@/components/ui";
import { ORDER_PAYMENT_LABEL, ORDER_STATUS_LABEL } from "@/lib/constants";
import { formatDate, monthName, naira } from "@/lib/format";
import { can, pageAdmin } from "@/server/auth";
import { inventoryCounts, lifetimeTotals, monthlySeries, orderCounts, outstandingBalances, parsePeriod, periodRange, periodSummary } from "@/server/services/finance";
import { getSite, isPlaceholderContact } from "@/server/settings";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await pageAdmin();
  const sp = await searchParams;
  const finance = can(admin, "finance");
  const { year, month } = parsePeriod(sp, false);
  const { from, to } = periodRange(year, month);

  const [inv, oc, site, recent] = await Promise.all([
    inventoryCounts(), orderCounts(), getSite(),
    db.select({ o: orders, name: customers.name }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).orderBy(desc(orders.createdAt)).limit(6),
  ]);
  const [period, series, balances, life] = finance
    ? await Promise.all([periodSummary(from, to), monthlySeries(year), outstandingBalances(), lifetimeTotals()])
    : [null, null, null, null];
  const label = month ? `${monthName(month)} ${year}` : `${year}`;

  return (
    <>
      <PageHeader title={`Welcome back, ${admin.name.split(" ")[0]}`} subtitle="Here's how the dealership is doing."
        actions={<><LinkButton href="/admin/vehicles/new" variant="outline" size="sm">+ Add vehicle</LinkButton>{finance && <LinkButton href="/admin/crm/sales/new" size="sm">+ Record sale</LinkButton>}</>} />
      {sp.denied && <div className="mb-4"><Notice tone="warn">Your role doesn&apos;t have access to that page.</Notice></div>}
      {isPlaceholderContact(site) && can(admin, "settings") && (
        <div className="mb-6"><Notice tone="gold">The public site still shows placeholder contact details. <Link href="/admin/settings" className="font-semibold underline">Add your real phone, WhatsApp and address →</Link></Notice></div>
      )}

      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted">Inventory</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total vehicles" value={inv.total} hint={`${inv.units} units in stock`} />
        <StatCard label="Available" value={inv.available} tone="ok" />
        <StatCard label="Reserved" value={inv.reserved} />
        <StatCard label="Sold" value={inv.sold} />
        <StatCard label="Out of stock" value={inv.outOfStock} tone={inv.outOfStock ? "bad" : undefined} />
      </div>

      <h2 className="mt-8 mb-3 text-[13px] font-semibold uppercase tracking-wider text-muted">Orders &amp; agents</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total orders" value={oc.orders} />
        <StatCard label="Pending orders" value={oc.pendingOrders} tone={oc.pendingOrders ? "gold" : undefined} hint={<Link href="/admin/orders?status=pending" className="underline">Review →</Link>} />
        <StatCard label="Total agents" value={oc.agents} hint={oc.pendingAgents ? `${oc.pendingAgents} awaiting approval` : undefined} />
        {balances ? <StatCard label="Pending agent commissions" value={naira(balances.commissionsPending)} hint={`${naira(balances.commissionsApproved)} approved, unpaid`} /> : <StatCard label="Enquiries" value="—" hint={<Link href="/admin/enquiries" className="underline">Open →</Link>} />}
      </div>

      {finance && period && series && balances && life && (
        <>
          <div className="mt-8 mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Finance · {label}</h2>
            <Suspense><PeriodFilter year={year} month={month} /></Suspense>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Sales revenue" value={naira(period.revenue)} tone="dark" hint={`${period.carsSold} car${period.carsSold === 1 ? "" : "s"} sold`} />
            <StatCard label="Vehicle purchase costs" value={naira(period.vehiclesPurchasedCost)} hint={`${period.vehiclesPurchased} unit(s) acquired`} />
            <StatCard label="Expenses" value={naira(period.operatingExpenses)} />
            <StatCard label="Net profit" value={naira(period.netProfit)} tone={period.netProfit < 0 ? "bad" : "ok"} hint="After cost of cars sold & expenses" />
          </div>
          <p className="mt-2 text-[12px] text-stone">All time: revenue {naira(life.revenue)} · purchase costs {naira(life.purchaseCosts)} · expenses {naira(life.expenses)} · net profit {naira(life.netProfit)}</p>

          <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
            <Section title={`Revenue, costs & profit — ${year}`}><FinanceChart data={series} /></Section>
            <Section title={`Vehicles sold — ${year}`}>
              <SalesCountChart data={series} />
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                <div><p className="text-muted">Customer balances</p><p className="font-semibold tabular-nums text-ink">{naira(balances.customerOutstanding)}</p></div>
                <div><p className="text-muted">Commission liability</p><p className="font-semibold tabular-nums text-ink">{naira(balances.commissionLiability)}</p></div>
              </div>
            </Section>
          </div>
        </>
      )}

      <Section title="Latest orders" className="mt-6" actions={<Link href="/admin/orders" className="text-sm text-muted hover:text-ink">View all →</Link>}>
        {recent.length ? (
          <ul className="-my-2 divide-y divide-line">
            {recent.map(({ o, name }) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:opacity-80">
                  <div><p className="font-medium text-ink">{name}</p><p className="text-[12.5px] text-muted">{o.reference} · {formatDate(o.createdAt)}</p></div>
                  <div className="flex items-center gap-2"><span className="text-sm font-semibold tabular-nums">{naira(o.total)}</span><StatusBadge value={o.status} map={ORDER_TONES} labels={ORDER_STATUS_LABEL} /><StatusBadge value={o.paymentStatus} map={PAY_TONES} labels={ORDER_PAYMENT_LABEL} /></div>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">No orders yet.</p>}
      </Section>
    </>
  );
}
