import { Suspense } from "react";
import Link from "next/link";
import { desc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { TableFilters } from "@/components/admin/filters";
import { CustomerCreate } from "@/components/admin/customer-create";
import { EmptyState, PageHeader, Pagination, TableWrap } from "@/components/ui";
import { ADMIN_PAGE_SIZE } from "@/lib/constants";
import { formatDate, naira } from "@/lib/format";
import { pageAdmin } from "@/server/auth";

export const metadata = { title: "Customers" };

/** Per-customer totals computed in SQL with the same formula as lib/finance (sale amount = price − discount + extra income). */
const spentSql = sql<number>`(select coalesce(sum(greatest(0, s.selling_price - s.discount + s.additional_income)),0)::bigint from sales s where s.customer_id = "customers"."id")`;
const paidSql = sql<number>`(select coalesce(sum(p.amount),0)::bigint from sale_payments p join sales s on s.id = p.sale_id where s.customer_id = "customers"."id")`;
const outstandingSql = sql<number>`(select coalesce(sum(greatest(0, greatest(0, s.selling_price - s.discount + s.additional_income) - coalesce((select sum(p.amount) from sale_payments p where p.sale_id = s.id),0))),0)::bigint from sales s where s.customer_id = "customers"."id")`;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin("customers");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const like = sp.q ? `%${sp.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%` : null;
  const where = like ? or(ilike(customers.name, like), ilike(customers.phone, like), ilike(customers.email, like)) : undefined;
  const [rows, [{ n }]] = await Promise.all([
    db.select({
      c: customers,
      orders: sql<number>`(select count(*)::int from orders o where o.customer_id = "customers"."id")`,
      purchases: sql<number>`(select count(*)::int from sales s where s.customer_id = "customers"."id")`,
      spent: spentSql, paid: paidSql, outstanding: outstandingSql,
    }).from(customers).where(where).orderBy(desc(customers.createdAt)).limit(ADMIN_PAGE_SIZE).offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(customers).where(where),
  ]);
  const pages = Math.max(1, Math.ceil(n / ADMIN_PAGE_SIZE));

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone who has ordered, bought or been added manually. Customers never need an account." actions={<CustomerCreate />} />
      <Suspense><TableFilters placeholder="Search name, phone or email…" /></Suspense>
      {rows.length === 0 ? <EmptyState title="No customers found" body="Customers are added automatically when they place an order or a sale is recorded." /> : (
        <>
          <div className="hidden md:block">
            <TableWrap>
              <table className="table-x">
                <thead><tr><th>Customer</th><th>Contact</th><th className="text-center">Orders</th><th className="text-center">Purchases</th><th className="text-right">Total spent</th><th className="text-right">Outstanding</th><th>Since</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.c.id}>
                      <td><Link href={`/admin/customers/${r.c.id}`} className="font-medium text-ink hover:underline">{r.c.name}</Link></td>
                      <td><p>{r.c.phone}</p><p className="text-[12px] text-muted">{r.c.email ?? ""}</p></td>
                      <td className="text-center tabular-nums">{r.orders}</td>
                      <td className="text-center tabular-nums">{r.purchases}</td>
                      <td className="text-right tabular-nums">{naira(Number(r.spent))}</td>
                      <td className={`text-right tabular-nums ${Number(r.outstanding) > 0 ? "font-medium text-warn" : "text-stone"}`}>{naira(Number(r.outstanding))}</td>
                      <td className="text-muted">{formatDate(r.c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
          <div className="space-y-3 md:hidden">
            {rows.map((r) => (
              <Link key={r.c.id} href={`/admin/customers/${r.c.id}`} className="card block p-4">
                <div className="flex justify-between gap-3"><p className="font-medium text-ink">{r.c.name}</p><span className="tabular-nums">{naira(Number(r.spent))}</span></div>
                <p className="text-sm text-muted">{r.c.phone}</p>
                <p className="mt-2 text-[12px] text-stone">{r.orders} orders · {r.purchases} purchases{Number(r.outstanding) > 0 && <span className="text-warn"> · {naira(Number(r.outstanding))} owed</span>}</p>
              </Link>
            ))}
          </div>
          <Pagination page={page} pages={pages} href={(p) => `/admin/customers?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
        </>
      )}
    </>
  );
}
