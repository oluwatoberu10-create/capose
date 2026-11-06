import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentCommissions, agents, customers, orders, referrals, sales, users, vehicles } from "@/db/schema";
import { COMMISSION_TONES, EmptyState, ORDER_TONES, PageHeader, StatCard, StatusBadge, TableWrap } from "@/components/ui";
import { COMMISSION_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/lib/constants";
import { formatDate, naira } from "@/lib/format";
import { pageAdmin } from "@/server/auth";

export const metadata = { title: "Referrals" };

export default async function ReferralsPage() {
  await pageAdmin("agents");
  const [rows, [visits]] = await Promise.all([
    db.select({
      r: referrals, agentName: users.name, agentId: agents.id, customer: customers.name, customerId: customers.id,
      vehicle: sql<string | null>`coalesce(${sales.vehicleTitle}, ${vehicles.title})`, order: orders.reference, orderId: orders.id, orderStatus: orders.status,
      commission: agentCommissions.amount, commissionStatus: agentCommissions.status,
    }).from(referrals)
      .innerJoin(agents, eq(agents.id, referrals.agentId)).innerJoin(users, eq(users.id, agents.userId))
      .leftJoin(customers, eq(customers.id, referrals.customerId)).leftJoin(orders, eq(orders.id, referrals.orderId))
      .leftJoin(sales, eq(sales.id, referrals.saleId)).leftJoin(vehicles, eq(vehicles.id, referrals.vehicleId))
      .leftJoin(agentCommissions, eq(agentCommissions.saleId, referrals.saleId))
      .orderBy(desc(referrals.createdAt)).limit(300),
    db.select({ n: sql<number>`count(*)::int` }).from(sql`referral_visits`),
  ]);
  const converted = rows.filter((r) => r.r.saleId).length;

  return (
    <>
      <PageHeader title="Referrals" subtitle="Every order or sale attributed to an agent. Attribution is saved when a customer orders through an agent link (kept for 90 days) or assigned manually." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Link visits" value={visits.n} />
        <StatCard label="Referrals" value={rows.length} />
        <StatCard label="Converted to sales" value={converted} />
        <StatCard label="Conversion" value={rows.length ? `${Math.round((converted / rows.length) * 100)}%` : "—"} />
      </div>
      {rows.length === 0 ? <EmptyState title="No referrals yet" body="When a customer orders through an agent's link, it shows here." /> : (
        <TableWrap>
          <table className="table-x">
            <thead><tr><th>Date</th><th>Agent</th><th>Customer</th><th>Vehicle</th><th>Order</th><th className="text-right">Commission</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.r.id}>
                  <td className="text-muted">{formatDate(x.r.createdAt)}</td>
                  <td><Link href={`/admin/agents/${x.agentId}`} className="font-medium text-ink hover:underline">{x.agentName}</Link><p className="font-mono text-[11.5px] text-stone">{x.r.referralCode}</p></td>
                  <td>{x.customerId ? <Link href={`/admin/customers/${x.customerId}`} className="hover:underline">{x.customer}</Link> : "—"}</td>
                  <td className="max-w-[220px] truncate">{x.vehicle ?? "—"}</td>
                  <td>{x.orderId ? <Link href={`/admin/orders/${x.orderId}`} className="flex flex-col gap-1"><span className="font-mono text-[12px] underline">{x.order}</span>{x.orderStatus && <StatusBadge value={x.orderStatus} map={ORDER_TONES} labels={ORDER_STATUS_LABEL} />}</Link> : <span className="text-[12px] text-stone">Direct sale</span>}</td>
                  <td className="text-right tabular-nums">{x.commission !== null ? naira(x.commission) : "—"}</td>
                  <td>{x.commissionStatus ? <StatusBadge value={x.commissionStatus} map={COMMISSION_TONES} labels={COMMISSION_STATUS_LABEL} /> : x.r.saleId ? <Link href={`/admin/crm/sales/${x.r.saleId}`} className="text-[12px] underline">Sold — no profit</Link> : <span className="text-[12px] text-stone">Awaiting sale</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
