import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { agentCommissions, agents, commissionPayouts, sales, users } from "@/db/schema";
import { PayoutForm } from "@/components/admin/payout-form";
import { ConfirmAction } from "@/components/form";
import { EmptyState, Notice, PageHeader, Section, TableWrap } from "@/components/ui";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, naira } from "@/lib/format";
import { removePayout } from "@/server/actions/admin-crm";
import { can, pageAdmin } from "@/server/auth";
import { agentOptions } from "@/server/services/sales";

export const metadata = { title: "Commission payouts" };

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ agent?: string }> }) {
  const admin = await pageAdmin("agents");
  const sp = await searchParams;
  const agentId = sp.agent && /^[0-9a-f-]{36}$/i.test(sp.agent) ? sp.agent : null;
  const [payouts, approved, agentList] = await Promise.all([
    db.select({ p: commissionPayouts, agentName: users.name }).from(commissionPayouts).innerJoin(agents, eq(agents.id, commissionPayouts.agentId)).innerJoin(users, eq(users.id, agents.userId))
      .where(agentId ? eq(commissionPayouts.agentId, agentId) : undefined).orderBy(desc(commissionPayouts.paidOn), desc(commissionPayouts.createdAt)).limit(200),
    db.select({ id: agentCommissions.id, agentId: agentCommissions.agentId, amount: agentCommissions.amount, vehicle: sales.vehicleTitle, saleDate: sales.saleDate, customer: sales.customerName })
      .from(agentCommissions).innerJoin(sales, eq(sales.id, agentCommissions.saleId)).where(and(eq(agentCommissions.status, "approved"))).orderBy(sales.saleDate),
    agentOptions(),
  ]);
  const finance = can(admin, "finance");
  const withApproved = agentList.filter((a) => approved.some((c) => c.agentId === a.id));

  return (
    <>
      <PageHeader title="Commission payouts" subtitle="Record money paid to agents. Each payout marks its commissions as paid and is booked as an ‘Agent commissions’ expense." />
      <Section title="Record a payout" className="mb-6">
        {!finance ? <Notice tone="warn">Recording payouts needs finance access.</Notice> : withApproved.length === 0 ? (
          <p className="text-sm text-muted">No approved commissions are waiting to be paid. Approve commissions on the <Link href="/admin/commissions?status=pending" className="underline">Commissions</Link> page first.</p>
        ) : <PayoutForm key={approved.map((c) => c.id).join()} agents={withApproved} commissions={approved} initialAgent={agentId && withApproved.some((a) => a.id === agentId) ? agentId : withApproved[0].id} />}
      </Section>
      <h2 className="mb-3 text-lg font-semibold">Payout history{agentId && <Link href="/admin/payouts" className="ml-2 text-sm font-normal text-muted underline">show all agents</Link>}</h2>
      {payouts.length === 0 ? <EmptyState title="No payouts yet" /> : (
        <TableWrap>
          <table className="table-x">
            <thead><tr><th>Date</th><th>Agent</th><th className="text-right">Amount</th><th>Method</th><th>Reference</th><th /></tr></thead>
            <tbody>
              {payouts.map(({ p, agentName }) => (
                <tr key={p.id}>
                  <td className="text-muted">{formatDate(p.paidOn)}</td>
                  <td><Link href={`/admin/agents/${p.agentId}`} className="font-medium text-ink hover:underline">{agentName}</Link>{p.notes && <p className="text-[12px] text-muted">{p.notes}</p>}</td>
                  <td className="text-right font-semibold tabular-nums">{naira(p.amount)}</td>
                  <td>{PAYMENT_METHOD_LABEL[p.method]}</td>
                  <td className="font-mono text-[12px]">{p.reference ?? "—"}</td>
                  <td className="text-right">{finance && <ConfirmAction action={removePayout} fields={{ id: p.id }} label="Undo" variant="ghost" confirmTitle="Undo this payout?" confirmBody="Its commissions go back to Approved and the matching expense is removed. Use this only if the payout was recorded by mistake." confirmLabel="Undo payout" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
