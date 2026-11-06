import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { vehicleColors } from "@/db/schema";
import { SaleForm } from "@/components/admin/sale-form";
import { ActionForm, ConfirmAction, Field, InlineAction, MoneyInput, SubmitButton } from "@/components/form";
import { COMMISSION_TONES, Notice, PAY_TONES, PageHeader, Section, StatCard, StatusBadge } from "@/components/ui";
import { COMMISSION_STATUS_LABEL, PAYMENT_METHOD_LABEL, SALE_PAYMENT_LABEL } from "@/lib/constants";
import { formatDate, naira, todayISO } from "@/lib/format";
import { commissionAction, recordSalePayment, removeSale, removeSalePayment } from "@/server/actions/admin-crm";
import { can, pageAdmin } from "@/server/auth";
import { agentOptions, approvalBlocker, getSale } from "@/server/services/sales";
import { vehicleOptions } from "@/server/services/vehicles";

export const metadata = { title: "Sale" };

export default async function SaleDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const admin = await pageAdmin("finance");
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await getSale(id);
  if (!s) notFound();
  const [vehicleList, colors, agentList] = await Promise.all([
    vehicleOptions(),
    db.select({ id: vehicleColors.id, vehicleId: vehicleColors.vehicleId, name: vehicleColors.name, stockQuantity: vehicleColors.stockQuantity }).from(vehicleColors).orderBy(asc(vehicleColors.position)),
    agentOptions(),
  ]);
  const c = s.commission;
  const blocker = c ? approvalBlocker(c, s) : null;
  const paidLock = c?.status === "paid" ? "The agent commission on this sale is paid, so profit figures and the agent can't change." : null;

  return (
    <>
      <PageHeader title={s.vehicleTitle} back={{ href: "/admin/crm/sales", label: "Sales records" }}
        subtitle={<span className="flex flex-wrap items-center gap-2">Sold {formatDate(s.saleDate)} to {s.customerName} <StatusBadge value={s.paymentStatus} map={PAY_TONES} labels={SALE_PAYMENT_LABEL} />{s.order && <Link href={`/admin/orders/${s.order.id}`} className="text-[12.5px] underline">Order {s.order.reference}</Link>}</span>}
        actions={c?.status !== "paid" ? <ConfirmAction action={removeSale} fields={{ id: s.id }} label="Delete sale" confirmTitle="Delete this sale?" confirmBody="Its payments and any unpaid commission are deleted, and the stock unit is returned to inventory. This cannot be undone." confirmLabel="Delete sale" /> : undefined} />
      {created && <div className="mb-4"><Notice tone="info"><strong>Sale recorded.</strong> {s.agent ? `A commission for ${s.agent.name} was calculated from the profit.` : ""} Add further payments below as they come in.</Notice></div>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sale amount" value={naira(s.total)} tone="dark" />
        <StatCard label="Received" value={naira(s.received)} tone="ok" />
        <StatCard label="Outstanding" value={naira(s.outstanding)} tone={s.outstanding ? "gold" : undefined} />
        <StatCard label="Net vehicle profit" value={naira(s.profit)} tone={s.profit < 0 ? "bad" : undefined} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Section title="Payments received">
          {s.payments.length ? (
            <ul className="-mt-2 mb-4 divide-y divide-line text-sm">
              {s.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div><p className="font-medium tabular-nums text-ink">{naira(p.amount)}</p><p className="text-[12px] text-muted">{formatDate(p.paidOn)} · {PAYMENT_METHOD_LABEL[p.method]}{p.reference ? ` · ${p.reference}` : ""}</p></div>
                  <ConfirmAction action={removeSalePayment} fields={{ id: p.id }} label="Remove" variant="ghost" confirmTitle="Remove this payment?" confirmBody="The outstanding balance increases by this amount." confirmLabel="Remove payment" />
                </li>
              ))}
            </ul>
          ) : <p className="mb-4 text-sm text-muted">No payments recorded yet.</p>}
          {s.outstanding > 0 ? (
            <ActionForm action={recordSalePayment} resetOnSuccess className="grid gap-3 rounded-xl bg-mist/60 p-4 sm:grid-cols-2">
              <input type="hidden" name="saleId" value={s.id} />
              <Field label="Amount" name="amount"><MoneyInput name="amount" defaultValue={s.outstanding} /></Field>
              <Field label="Date" name="paidOn"><input id="paidOn" name="paidOn" type="date" defaultValue={todayISO()} className="field" /></Field>
              <Field label="Method" name="method"><select id="method" name="method" className="field" defaultValue={s.paymentMethod}>{Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="Reference (optional)" name="reference"><input id="reference" name="reference" className="field" placeholder="Transfer ref / receipt #" /></Field>
              <SubmitButton className="sm:col-span-2">Record payment</SubmitButton>
            </ActionForm>
          ) : <Notice tone="info">Fully paid.</Notice>}
        </Section>

        <Section title="Agent commission">
          {!s.agent ? <p className="text-sm text-muted">No referral agent on this sale. Assign one in the form below if this was a referral.</p> : !c ? (
            <p className="text-sm text-muted">Referred by <strong className="text-ink">{s.agent.name}</strong>. No commission — the sale made no profit.</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm">Agent: <Link href={`/admin/agents/${s.agent.id}`} className="font-medium text-ink underline">{s.agent.name}</Link> <span className="font-mono text-[12px] text-muted">{s.agent.code}</span></p>
                  <p className="mt-1 text-[12.5px] text-muted">{c.ratePercent}% × {naira(c.profitAmount)} net profit</p>
                </div>
                <StatusBadge value={c.status} map={COMMISSION_TONES} labels={COMMISSION_STATUS_LABEL} />
              </div>
              <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-ink">{naira(c.amount)}</p>
              {c.status === "pending" && blocker && <p className="mt-3 rounded-lg bg-[#fdf6ea] px-3 py-2 text-[12.5px] text-[#7a4a00]">{blocker}</p>}
              {can(admin, "agents") && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {c.status === "pending" && !blocker && <InlineAction action={commissionAction} fields={{ id: c.id, op: "approve" }} variant="primary">Approve commission</InlineAction>}
                  {(c.status === "pending" || c.status === "approved") && <ConfirmAction action={commissionAction} fields={{ id: c.id, op: "cancel" }} label="Cancel" confirmTitle="Cancel this commission?" confirmBody="The agent will see it as Cancelled. You can reopen it later." confirmLabel="Cancel commission" />}
                  {c.status === "cancelled" && <InlineAction action={commissionAction} fields={{ id: c.id, op: "reopen" }}>Reopen</InlineAction>}
                  {c.status === "approved" && <Link href={`/admin/payouts?agent=${c.agentId}`} className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3.5 text-[13px] font-medium">Record payout →</Link>}
                </div>
              )}
            </>
          )}
        </Section>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Edit sale</h2>
      <SaleForm key={s.updatedAt.toISOString()} initial={s} vehicles={vehicleList} colors={colors} agents={agentList} orderRef={s.order?.reference} locked={paidLock} />
    </>
  );
}
