import { Suspense } from "react";
import Link from "next/link";
import { and, desc, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { vehicleAcquisitions } from "@/db/schema";
import { PeriodFilter, TableFilters } from "@/components/admin/filters";
import { EmptyState, LinkButton, Notice, PageHeader, Pagination, StatCard, TableWrap } from "@/components/ui";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { formatDate, naira } from "@/lib/format";
import { pageAdmin } from "@/server/auth";
import { periodRange } from "@/server/services/finance";

export const metadata = { title: "Acquisitions" };

export default async function AcquisitionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin("finance");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const year = Number(sp.year) || null;
  const month = sp.month && sp.month !== "all" ? Number(sp.month) : null;
  const w: (SQL | undefined)[] = [];
  if (year) { const r = periodRange(year, month); w.push(gte(vehicleAcquisitions.purchaseDate, r.from), lt(vehicleAcquisitions.purchaseDate, r.to)); }
  if (sp.q) { const like = `%${sp.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`; w.push(or(ilike(vehicleAcquisitions.brand, like), ilike(vehicleAcquisitions.model, like), ilike(vehicleAcquisitions.stockNumber, like), ilike(vehicleAcquisitions.seller, like))); }
  const where = and(...w);
  const [rows, [agg]] = await Promise.all([
    db.select().from(vehicleAcquisitions).where(where).orderBy(desc(vehicleAcquisitions.purchaseDate), desc(vehicleAcquisitions.createdAt)).limit(ADMIN_PAGE_SIZE).offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${vehicleAcquisitions.totalCost}),0)::bigint`, units: sql<number>`coalesce(sum(${vehicleAcquisitions.units}),0)::int`, price: sql<number>`coalesce(sum(${vehicleAcquisitions.purchasePrice}),0)::bigint` }).from(vehicleAcquisitions).where(where),
  ]);
  const pages = Math.max(1, Math.ceil(agg.n / ADMIN_PAGE_SIZE));

  return (
    <>
      <PageHeader title="Vehicle acquisitions" subtitle="What the dealership paid for each car, including transport, customs and repairs." actions={<LinkButton href="/admin/crm/acquisitions/new">+ Record acquisition</LinkButton>} />
      {sp.saved && <div className="mb-4"><Notice tone="info">Acquisition recorded.</Notice></div>}
      {sp.deleted && <div className="mb-4"><Notice tone="info">Acquisition deleted.</Notice></div>}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Records" value={agg.n} hint={`${agg.units} unit(s)`} />
        <StatCard label="Purchase prices" value={naira(Number(agg.price))} />
        <StatCard label="Acquisition expenses" value={naira(Number(agg.total) - Number(agg.price))} />
        <StatCard label="Total acquisition cost" value={naira(Number(agg.total))} tone="dark" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1"><Suspense><TableFilters placeholder="Search brand, model, stock # or seller…" /></Suspense></div>
        <Suspense><PeriodFilter year={year ?? new Date().getFullYear()} month={month} /></Suspense>
      </div>
      {!year && <p className="mb-3 text-[12px] text-stone">Showing all dates. Choose a month or year to narrow down.</p>}
      {rows.length === 0 ? <EmptyState title="No acquisitions recorded" body="Record what each car cost so profit and agent commissions are accurate." action={<LinkButton href="/admin/crm/acquisitions/new">Record acquisition</LinkButton>} /> : (
        <>
          <TableWrap>
            <table className="table-x">
              <thead><tr><th>Date</th><th>Vehicle</th><th>Seller</th><th className="text-center">Units</th><th className="text-right">Purchase price</th><th className="text-right">Expenses</th><th className="text-right">Total cost</th><th>Listing</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-muted">{formatDate(a.purchaseDate)}</td>
                    <td><Link href={`/admin/crm/acquisitions/${a.id}`} className="font-medium text-ink hover:underline">{a.year} {a.brand} {a.model}</Link>{a.stockNumber && <p className="font-mono text-[11.5px] text-stone">#{a.stockNumber}</p>}</td>
                    <td className="text-muted">{a.seller ?? "—"}</td>
                    <td className="text-center tabular-nums">{a.units}</td>
                    <td className="text-right tabular-nums">{naira(a.purchasePrice)}</td>
                    <td className="text-right tabular-nums text-muted">{naira(a.totalCost - a.purchasePrice)}</td>
                    <td className="text-right font-semibold tabular-nums">{naira(a.totalCost)}</td>
                    <td>{a.vehicleId ? <Link href={`/admin/vehicles/${a.vehicleId}`} className="text-[12.5px] text-gold underline">Linked</Link> : <span className="text-[12.5px] text-stone">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={page} pages={pages} href={(p) => `/admin/crm/acquisitions?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page")) as Record<string, string>, page: String(p) })}`} />
        </>
      )}
    </>
  );
}
