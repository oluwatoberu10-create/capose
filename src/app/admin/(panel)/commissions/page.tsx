import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { agentCommissions, agents, sales, users } from "@/db/schema";
import { ConfirmAction, InlineAction } from "@/components/form";
import { COMMISSION_TONES, EmptyState, Notice, PAY_TONES, PageHeader, StatCard, StatusBadge, TableWrap } from "@/components/ui";
import { COMMISSION_STATUS_LABEL, SALE_PAYMENT_LABEL } from "@/lib/constants";
import { formatDate, naira } from "@/lib/format";
import { commissionAction } from "@/server/actions/admin-crm";
import { can, pageAdmin } from "@/server/auth";
import { approvalBlocker, withSaleFigures } from "@/server/services/sales";

export const metadata = { title: "Commissions" };
const STATUSES = ["pending", "approved", "paid", "cancelled"] as const;

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ status?: string; agent?: string }> }) {
  const admin = await pageAdmin("agents");
  const sp = await searchParams;
  const w: (SQL | undefined)[] = [];
  if (sp.status && (STATUSES as readonly string[]).includes(sp.status)) w.push(eq(agentCommissions.status, sp.status as (typeof STATUSES)[number]));
  if (sp.agent && /^[0-9a-f-]{36}$/i.test(sp.agent)) w.push(eq(agentCommissions.agentId, sp.agent));
  const rows = await db.select({ c: agentCommissions, s: sales, agentName: users.name, code: agents.referralCode })
    .from(agentCommissions).innerJoin(sales, eq(sales.id, agentCommissions.saleId))
    .innerJoin(agents, eq(agents.id, agentCommissions.agentId)).innerJoin(users, eq(users.id, agents.userId))
    .where(and(...w)).orderBy(desc(sales.saleDate)).limit(300);
  const figures = await withSaleFigures(db, rows.map((r) => r.s));
  const fig = new Map(figures.map((f) => [f.id, f]));
  const sumBy = (st: string) => rows.filter((r) => r.c.status === st).reduce((s, r) => s + r.c.amount, 0);
  const finance = can(admin, "finance");

  return (
    <>
      <PageHeader title="Commissions" subtitle="10% of each referred sale's net profit. Approve only after the sale is completed and fully paid." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pending review" value={naira(sumBy("pending"))} />
        <StatCard label="Approved, unpaid" value={naira(sumBy("approved"))} tone="gold" />
        <StatCard label="Paid" value={naira(sumBy("paid"))} tone="ok" />
        <StatCard label="Total liability" value={naira(sumBy("pending") + sumBy("approved"))} tone="dark" />
      </div>
      {!finance && <div className="mb-4"><Notice tone="warn">Approving or cancelling commissions needs finance access.</Notice></div>}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[["", "All"], ...STATUSES.map((s) => [s, COMMISSION_STATUS_LABEL[s]])].map(([v, l]) => (
          <Link key={v} href={`/admin/commissions?${new URLSearchParams({ ...(v ? { status: v } : {}), ...(sp.agent ? { agent: sp.agent } : {}) })}`} className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium ${(sp.status ?? "") === v ? "bg-ink text-white" : "border border-line bg-white"}`}>{l}</Link>
        ))}
        {sp.agent && <Link href="/admin/commissions" className="rounded-lg px-3 py-1.5 text-[13px] text-muted underline">Clear agent filter</Link>}
      </div>
      {rows.length === 0 ? <EmptyState title="No commissions" body="Commissions are created automatically when a sale with a referral agent makes a profit." /> : (
        <TableWrap>
          <table className="table-x">
            <thead><tr><th>Sale</th><th>Agent</th><th className="text-right">Net profit</th><th className="text-right">Commission</th><th>Sale payment</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.map(({ c, s, agentName, code }) => {
                const f = fig.get(s.id)!;
                const blocker = approvalBlocker(c, f);
                return (
                  <tr key={c.id}>
                    <td className="max-w-[240px]"><Link href={`/admin/crm/sales/${s.id}`} className="block truncate font-medium text-ink hover:underline">{s.vehicleTitle}</Link><p className="text-[12px] text-muted">{formatDate(s.saleDate)} · {s.customerName}</p></td>
                    <td><Link href={`/admin/agents/${c.agentId}`} className="hover:underline">{agentName}</Link><p className="font-mono text-[11.5px] text-stone">{code}</p></td>
                    <td className="text-right tabular-nums">{naira(c.profitAmount)}</td>
                    <td className="text-right font-semibold tabular-nums">{naira(c.amount)}</td>
                    <td><StatusBadge value={f.paymentStatus} map={PAY_TONES} labels={SALE_PAYMENT_LABEL} /></td>
                    <td><StatusBadge value={c.status} map={COMMISSION_TONES} labels={COMMISSION_STATUS_LABEL} /></td>
                    <td className="text-right">
                      {finance && (
                        <div className="flex justify-end gap-1.5">
                          {c.status === "pending" && (blocker ? <span className="max-w-[220px] text-left text-[11.5px] leading-snug text-warn">{blocker}</span> : <InlineAction action={commissionAction} fields={{ id: c.id, op: "approve" }} variant="primary">Approve</InlineAction>)}
                          {c.status === "approved" && <Link href={`/admin/payouts?agent=${c.agentId}`} className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[13px]">Pay</Link>}
                          {(c.status === "pending" || c.status === "approved") && <ConfirmAction action={commissionAction} fields={{ id: c.id, op: "cancel" }} label="Cancel" variant="ghost" confirmTitle="Cancel this commission?" confirmLabel="Cancel commission" />}
                          {c.status === "cancelled" && <InlineAction action={commissionAction} fields={{ id: c.id, op: "reopen" }}>Reopen</InlineAction>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
