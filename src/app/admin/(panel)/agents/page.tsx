import Link from "next/link";
import { InlineAction } from "@/components/form";
import { AGENT_TONES, Badge, EmptyState, PageHeader, StatCard, StatusBadge, TableWrap } from "@/components/ui";
import { AGENT_STATUS_LABEL } from "@/lib/constants";
import { formatDate, naira } from "@/lib/format";
import { setAgentStatus } from "@/server/actions/admin-agents";
import { pageAdmin } from "@/server/auth";
import { listAgentsWithStats } from "@/server/services/agents";

export const metadata = { title: "Agents" };

export default async function AgentsAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await pageAdmin("agents");
  const { status } = await searchParams;
  const all = await listAgentsWithStats();
  const rows = status ? all.filter((a) => a.status === status) : all;
  const tot = all.reduce((t, a) => ({ pending: t.pending + a.pending, approved: t.approved + a.approved, paid: t.paid + a.paid, sales: t.sales + a.sales }), { pending: 0, approved: 0, paid: 0, sales: 0 });

  return (
    <>
      <PageHeader title="Agents" subtitle="Referral agents earn 10% of net profit on cars they refer, after admin approval." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Agents" value={all.length} hint={`${all.filter((a) => a.status === "pending").length} awaiting approval`} />
        <StatCard label="Referred sales" value={tot.sales} />
        <StatCard label="Commission liability" value={naira(tot.pending + tot.approved)} tone="gold" hint={`${naira(tot.approved)} approved, unpaid`} />
        <StatCard label="Paid to agents" value={naira(tot.paid)} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[["", "All"], ["pending", "Pending"], ["approved", "Approved"], ["suspended", "Suspended"]].map(([v, l]) => (
          <Link key={v} href={v ? `/admin/agents?status=${v}` : "/admin/agents"} className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium ${(status ?? "") === v ? "bg-ink text-white" : "border border-line bg-white"}`}>{l}</Link>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState title="No agents here" body="Agents register at /agents/register." /> : (
        <TableWrap>
          <table className="table-x">
            <thead><tr><th>Agent</th><th>Code</th><th className="text-center">Referrals</th><th className="text-center">Sales</th><th className="text-right">Pending</th><th className="text-right">Approved</th><th className="text-right">Paid</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/agents/${a.id}`} className="font-medium text-ink hover:underline">{a.name}</Link><p className="text-[12px] text-muted">{a.email} · joined {formatDate(a.createdAt)}</p></td>
                  <td className="font-mono text-[12.5px]">{a.code}{a.isDemo && <Badge tone="info" className="ml-1">Demo</Badge>}</td>
                  <td className="text-center tabular-nums">{a.referrals}</td>
                  <td className="text-center tabular-nums">{a.sales}</td>
                  <td className="text-right tabular-nums">{naira(a.pending)}</td>
                  <td className="text-right tabular-nums">{naira(a.approved)}</td>
                  <td className="text-right tabular-nums">{naira(a.paid)}</td>
                  <td><StatusBadge value={a.status} map={AGENT_TONES} labels={AGENT_STATUS_LABEL} /></td>
                  <td className="text-right">
                    {a.status !== "approved" && <InlineAction action={setAgentStatus} fields={{ id: a.id, status: "approved" }} variant="primary">Approve</InlineAction>}
                    {a.status === "approved" && <InlineAction action={setAgentStatus} fields={{ id: a.id, status: "suspended" }}>Suspend</InlineAction>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
