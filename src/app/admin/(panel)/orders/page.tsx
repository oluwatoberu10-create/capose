import { Suspense } from "react";
import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { agents, customers, orders, users } from "@/db/schema";
import { TableFilters } from "@/components/admin/filters";
import { EmptyState, Notice, ORDER_TONES, PAY_TONES, PageHeader, Pagination, StatusBadge, TableWrap } from "@/components/ui";
import { ADMIN_PAGE_SIZE, ORDER_PAYMENT_LABEL, ORDER_STATUS_LABEL } from "@/lib/constants";
import { formatDate, naira } from "@/lib/format";
import { pageAdmin } from "@/server/auth";

export const metadata = { title: "Orders" };

const STATUSES = ["pending", "confirmed", "processing", "completed", "cancelled"] as const;
const PAY = ["pending", "paid", "failed", "refunded"] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin("orders");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const w: (SQL | undefined)[] = [];
  if (sp.status && (STATUSES as readonly string[]).includes(sp.status)) w.push(eq(orders.status, sp.status as (typeof STATUSES)[number]));
  if (sp.payment && (PAY as readonly string[]).includes(sp.payment)) w.push(eq(orders.paymentStatus, sp.payment as (typeof PAY)[number]));
  if (sp.q) {
    const like = `%${sp.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    w.push(or(ilike(orders.reference, like), ilike(customers.name, like), ilike(customers.phone, like), ilike(customers.email, like),
      sql`exists (select 1 from order_items oi where oi.order_id = "orders"."id" and oi.vehicle_title ilike ${like})`));
  }
  const where = and(...w);
  const [rows, [{ n }]] = await Promise.all([
    db.select({
      o: orders, name: customers.name, phone: customers.phone, agentName: users.name,
      vehicle: sql<string>`(select string_agg(oi.vehicle_title || coalesce(' — ' || oi.color_name, ''), ', ') from order_items oi where oi.order_id = "orders"."id")`,
    }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId))
      .leftJoin(agents, eq(agents.id, orders.agentId)).leftJoin(users, eq(users.id, agents.userId))
      .where(where).orderBy(desc(orders.createdAt)).limit(ADMIN_PAGE_SIZE).offset((page - 1) * ADMIN_PAGE_SIZE),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(where),
  ]);
  const pages = Math.max(1, Math.ceil(n / ADMIN_PAGE_SIZE));
  const href = (p: number) => `/admin/orders?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page")) as Record<string, string>, page: String(p) })}`;

  return (
    <>
      <PageHeader title="Orders" subtitle="Order requests from the website. Online payment is not enabled — mark payments manually." />
      {sp.deleted && <div className="mb-4"><Notice tone="info">Order deleted.</Notice></div>}
      <Suspense>
        <TableFilters placeholder="Search reference, customer, phone or car…" statuses={STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }))}
          extra={[{ key: "payment", label: "Payment", options: PAY.map((p) => ({ value: p, label: ORDER_PAYMENT_LABEL[p] })) }]} />
      </Suspense>
      {rows.length === 0 ? <EmptyState title="No orders found" body={sp.q || sp.status ? "Try another search or filter." : "Orders placed on the website appear here."} /> : (
        <>
          <div className="hidden md:block">
            <TableWrap>
              <table className="table-x">
                <thead><tr><th>Reference</th><th>Customer</th><th>Vehicle</th><th className="text-right">Amount</th><th>Order</th><th>Payment</th><th>Date</th></tr></thead>
                <tbody>
                  {rows.map(({ o, name, phone, vehicle, agentName }) => (
                    <tr key={o.id}>
                      <td><Link href={`/admin/orders/${o.id}`} className="font-mono text-[12.5px] font-semibold text-ink hover:underline">{o.reference}</Link>{o.isDemo && <span className="ml-1 text-[11px] text-stone">demo</span>}</td>
                      <td><p className="font-medium text-ink">{name}</p><p className="text-[12px] text-muted">{phone}</p></td>
                      <td className="max-w-[260px]"><p className="truncate">{vehicle}</p>{agentName && <p className="text-[12px] text-gold">Ref: {agentName}</p>}</td>
                      <td className="text-right tabular-nums">{naira(o.total)}</td>
                      <td><StatusBadge value={o.status} map={ORDER_TONES} labels={ORDER_STATUS_LABEL} /></td>
                      <td><StatusBadge value={o.paymentStatus} map={PAY_TONES} labels={ORDER_PAYMENT_LABEL} /></td>
                      <td className="whitespace-nowrap text-muted">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
          <div className="space-y-3 md:hidden">
            {rows.map(({ o, name, vehicle }) => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="card block p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-medium text-ink">{name}</p><p className="font-mono text-[12px] text-muted">{o.reference}</p></div><span className="font-semibold tabular-nums">{naira(o.total)}</span></div>
                <p className="mt-2 truncate text-sm text-body">{vehicle}</p>
                <div className="mt-3 flex flex-wrap gap-1.5"><StatusBadge value={o.status} map={ORDER_TONES} labels={ORDER_STATUS_LABEL} /><StatusBadge value={o.paymentStatus} map={PAY_TONES} labels={ORDER_PAYMENT_LABEL} /><span className="ml-auto text-[12px] text-stone">{formatDate(o.createdAt)}</span></div>
              </Link>
            ))}
          </div>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}
    </>
  );
}
