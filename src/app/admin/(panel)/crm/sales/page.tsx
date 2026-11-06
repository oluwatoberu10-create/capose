import { Suspense } from "react";
import Link from "next/link";
import { and, desc, gte, ilike, lt, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { sales } from "@/db/schema";
import { PeriodFilter, TableFilters } from "@/components/admin/filters";
import { EmptyState, LinkButton, Notice, PAY_TONES, PageHeader, StatCard, StatusBadge, TableWrap } from "@/components/ui";
import { SALE_PAYMENT_LABEL } from "@/lib/constants";
import { formatDate, naira } from "@/lib/format";
import { pageAdmin } from "@/server/auth";
import { parsePeriod, periodRange } from "@/server/services/finance";
import { withSaleFigures } from "@/server/services/sales";

export const metadata = { title: "Sales records" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin("finance");
  const sp = await searchParams;
  const { year, month } = parsePeriod(sp, false);
  const { from, to } = periodRange(year, month);
  const w: (SQL | undefined)[] = [gte(sales.saleDate, from), lt(sales.saleDate, to)];
  if (sp.q) { const like = `%${sp.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`; w.push(or(ilike(sales.customerName, like), ilike(sales.customerPhone, like), ilike(sales.vehicleTitle, like))); }
  const rows = await withSaleFigures(db, await db.select().from(sales).where(and(...w)).orderBy(desc(sales.saleDate), desc(sales.createdAt)).limit(500));
  const shown = sp.status ? rows.filter((r) => r.paymentStatus === sp.status) : rows;
  const t = shown.reduce((a, r) => ({ total: a.total + r.total, received: a.received + r.received, outstanding: a.outstanding + r.outstanding, profit: a.profit + r.profit }), { total: 0, received: 0, outstanding: 0, profit: 0 });

  return (
    <>
      <PageHeader title="Sales records" subtitle="Every car sold — including sales paid outside the website." actions={<LinkButton href="/admin/crm/sales/new">+ Record sale</LinkButton>} />
      {sp.deleted && <div className="mb-4"><Notice tone="info">Sale deleted. Any stock it had deducted was restored.</Notice></div>}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sales total" value={naira(t.total)} tone="dark" hint={`${shown.length} sale(s)`} />
        <StatCard label="Received" value={naira(t.received)} tone="ok" />
        <StatCard label="Outstanding" value={naira(t.outstanding)} tone={t.outstanding ? "gold" : undefined} />
        <StatCard label="Net vehicle profit" value={naira(t.profit)} tone={t.profit < 0 ? "bad" : undefined} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1"><Suspense><TableFilters placeholder="Search customer, phone or vehicle…" statuses={Object.entries(SALE_PAYMENT_LABEL).map(([value, label]) => ({ value, label }))} /></Suspense></div>
        <Suspense><PeriodFilter year={year} month={month} /></Suspense>
      </div>
      {shown.length === 0 ? <EmptyState title="No sales in this period" body="Record a sale whenever a car is sold — even if the customer paid by transfer, cash or POS." action={<LinkButton href="/admin/crm/sales/new">Record sale</LinkButton>} /> : (
        <>
          <div className="hidden md:block">
            <TableWrap>
              <table className="table-x">
                <thead><tr><th>Date</th><th>Vehicle</th><th>Customer</th><th className="text-right">Total</th><th className="text-right">Received</th><th className="text-right">Balance</th><th className="text-right">Profit</th><th>Payment</th></tr></thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap text-muted">{formatDate(s.saleDate)}</td>
                      <td className="max-w-[240px]"><Link href={`/admin/crm/sales/${s.id}`} className="block truncate font-medium text-ink hover:underline">{s.vehicleTitle}</Link>{s.agentId && <span className="text-[11.5px] text-gold">Referred</span>}</td>
                      <td><p>{s.customerName}</p><p className="text-[12px] text-muted">{s.customerPhone}</p></td>
                      <td className="text-right tabular-nums">{naira(s.total)}</td>
                      <td className="text-right tabular-nums text-ok">{naira(s.received)}</td>
                      <td className={`text-right tabular-nums ${s.outstanding ? "text-warn" : "text-stone"}`}>{naira(s.outstanding)}</td>
                      <td className={`text-right tabular-nums ${s.profit < 0 ? "text-bad" : ""}`}>{naira(s.profit)}</td>
                      <td><StatusBadge value={s.paymentStatus} map={PAY_TONES} labels={SALE_PAYMENT_LABEL} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
          <div className="space-y-3 md:hidden">
            {shown.map((s) => (
              <Link key={s.id} href={`/admin/crm/sales/${s.id}`} className="card block p-4">
                <div className="flex justify-between gap-3"><p className="font-medium text-ink">{s.vehicleTitle}</p><StatusBadge value={s.paymentStatus} map={PAY_TONES} labels={SALE_PAYMENT_LABEL} /></div>
                <p className="text-sm text-muted">{s.customerName} · {formatDate(s.saleDate)}</p>
                <p className="mt-2 text-sm tabular-nums">{naira(s.received)} of {naira(s.total)}{s.outstanding > 0 && <span className="text-warn"> · {naira(s.outstanding)} due</span>}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
