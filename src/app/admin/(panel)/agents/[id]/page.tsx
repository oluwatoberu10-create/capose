import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, users } from "@/db/schema";
import { CopyField } from "@/components/copy-field";
import { RevealAction } from "@/components/admin/reveal-action";
import { ConfirmAction, InlineAction } from "@/components/form";
import { AGENT_TONES, COMMISSION_TONES, EmptyState, KV, ORDER_TONES, PageHeader, Section, StatCard, StatusBadge, TableWrap } from "@/components/ui";
import { AGENT_STATUS_LABEL, COMMISSION_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, naira, whatsappLink } from "@/lib/format";
import { resetAgentPassword, setAgentStatus } from "@/server/actions/admin-agents";
import { pageAdmin } from "@/server/auth";
import { agentReferralHistory, agentStats, recentVisits } from "@/server/services/agents";

export const metadata = { title: "Agent" };

export default async function AgentDetail({ params }: { params: Promise<{ id: string }> }) {
  await pageAdmin("agents");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db.select({ a: agents, u: users }).from(agents).innerJoin(users, eq(users.id, agents.userId)).where(eq(agents.id, id)).limit(1);
  if (!row) notFound();
  const { a, u } = row;
  const [stats, history, visits] = await Promise.all([agentStats(a.id), agentReferralHistory(a.id, { full: true }), recentVisits(a.id, 10)]);
  const h = await headers();
  const base = process.env.APP_URL?.replace(/\/$/, "") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <>
      <PageHeader title={u.name} back={{ href: "/admin/agents", label: "Agents" }}
        subtitle={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{a.referralCode}</span><StatusBadge value={a.status} map={AGENT_TONES} labels={AGENT_STATUS_LABEL} /></span>}
        actions={<>
          {a.status !== "approved" && <InlineAction action={setAgentStatus} fields={{ id: a.id, status: "approved" }} variant="primary">Approve agent</InlineAction>}
          {a.status !== "suspended" && <ConfirmAction action={setAgentStatus} fields={{ id: a.id, status: "suspended" }} label="Suspend" confirmTitle={`Suspend ${u.name}?`} confirmBody="New referrals through their link stop being credited. Existing commissions are unaffected." confirmLabel="Suspend agent" />}
        </>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Referrals" value={stats.referrals} hint={`${stats.visits} link visits`} />
        <StatCard label="Successful sales" value={stats.successfulSales} />
        <StatCard label="Pending" value={naira(stats.pending)} />
        <StatCard label="Approved, unpaid" value={naira(stats.approved)} tone="gold" />
        <StatCard label="Paid" value={naira(stats.paid)} tone="ok" />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title="Details">
          <KV items={[["Email", <a key="e" href={`mailto:${u.email}`} className="underline">{u.email}</a>], ["Phone", u.phone ? <a key="w" href={whatsappLink(u.phone)} target="_blank" className="underline">{u.phone}</a> : "—"], ["Joined", formatDate(a.createdAt)], ["Approved", a.approvedAt ? formatDate(a.approvedAt) : "—"], ["Last login", u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"]]} />
          <div className="mt-4"><CopyField value={`${base}/?ref=${a.referralCode}`} label="Referral link" /></div>
          <div className="mt-4"><RevealAction action={resetAgentPassword} fields={{ id: a.id }} label="Reset password" /></div>
        </Section>
        <Section title="Recent link visits">
          {visits.length ? <ul className="-my-2 divide-y divide-line text-sm">{visits.map((v, i) => <li key={i} className="flex justify-between gap-3 py-2.5"><span className="truncate">{v.vehicleTitle ?? v.path}</span><span className="shrink-0 text-[12px] text-stone">{formatDateTime(v.createdAt)}</span></li>)}</ul> : <p className="text-sm text-muted">No visits yet.</p>}
          <div className="mt-4 flex gap-2"><Link href={`/admin/commissions?agent=${a.id}`} className="text-sm underline">Commissions →</Link><Link href={`/admin/payouts?agent=${a.id}`} className="text-sm underline">Payouts →</Link></div>
        </Section>
      </div>
      <h2 className="mb-3 text-lg font-semibold">Referral history</h2>
      {history.length === 0 ? <EmptyState title="No referrals yet" /> : (
        <TableWrap>
          <table className="table-x">
            <thead><tr><th>Date</th><th>Customer</th><th>Vehicle</th><th>Order</th><th className="text-right">Profit</th><th className="text-right">Commission</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id}>
                  <td className="text-muted">{formatDate(r.createdAt)}</td>
                  <td><p className="font-medium text-ink">{r.customerName}</p><p className="text-[12px] text-muted">{r.customerPhone}</p></td>
                  <td>{r.vehicleTitle ?? "—"}</td>
                  <td>{r.orderReference ? <span className="flex flex-col gap-1"><span className="font-mono text-[12px]">{r.orderReference}</span>{r.orderStatus && <StatusBadge value={r.orderStatus} map={ORDER_TONES} labels={ORDER_STATUS_LABEL} />}</span> : r.saleId ? <Link href={`/admin/crm/sales/${r.saleId}`} className="text-[12.5px] underline">Direct sale</Link> : "—"}</td>
                  <td className="text-right tabular-nums">{r.profitAmount !== null ? naira(r.profitAmount) : "—"}</td>
                  <td className="text-right tabular-nums">{r.commissionAmount !== null ? naira(r.commissionAmount) : "—"}</td>
                  <td>{r.commissionStatus ? <StatusBadge value={r.commissionStatus} map={COMMISSION_TONES} labels={COMMISSION_STATUS_LABEL} /> : <span className="text-[12px] text-stone">{r.saleId ? "No profit" : "Awaiting sale"}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
