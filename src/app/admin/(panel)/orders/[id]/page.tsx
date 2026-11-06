import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, customers, orderItems, orders, referrals, sales, users } from "@/db/schema";
import { ActionForm, ConfirmAction, Field, SubmitButton } from "@/components/form";
import { KV, LinkButton, Notice, ORDER_TONES, PAY_TONES, PageHeader, Section, StatusBadge } from "@/components/ui";
import { ORDER_PAYMENT_LABEL, ORDER_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, naira, whatsappLink } from "@/lib/format";
import { deleteOrder, setOrderAgent, updateOrder } from "@/server/actions/admin-orders";
import { can, pageAdmin } from "@/server/auth";
import { agentOptions } from "@/server/services/sales";

export const metadata = { title: "Order" };

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await pageAdmin("orders");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db.select({ o: orders, c: customers }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(eq(orders.id, id)).limit(1);
  if (!row) notFound();
  const { o, c } = row;
  const [items, [agent], [sale], [ref], agentList] = await Promise.all([
    db.select({ i: orderItems, cover: sql<string | null>`(select vi.url from vehicle_images vi where vi.vehicle_id = "order_items"."vehicle_id" order by vi.is_featured desc, vi.position limit 1)` }).from(orderItems).where(eq(orderItems.orderId, id)),
    o.agentId ? db.select({ id: agents.id, name: users.name, code: agents.referralCode, status: agents.status }).from(agents).innerJoin(users, eq(users.id, agents.userId)).where(eq(agents.id, o.agentId)).limit(1) : Promise.resolve([]),
    db.select({ id: sales.id, date: sales.saleDate }).from(sales).where(eq(sales.orderId, id)).limit(1),
    db.select().from(referrals).where(eq(referrals.orderId, id)).limit(1),
    can(admin, "agents") ? agentOptions() : Promise.resolve([]),
  ]);
  const finance = can(admin, "finance");

  return (
    <>
      <PageHeader title={`Order ${o.reference}`} back={{ href: "/admin/orders", label: "Orders" }}
        subtitle={<span className="flex flex-wrap items-center gap-2">Placed {formatDateTime(o.createdAt)} <StatusBadge value={o.status} map={ORDER_TONES} labels={ORDER_STATUS_LABEL} /><StatusBadge value={o.paymentStatus} map={PAY_TONES} labels={ORDER_PAYMENT_LABEL} /></span>}
        actions={<>
          <a href={whatsappLink(c.phone, `Hello ${c.name.split(" ")[0]}, this is regarding your order ${o.reference}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3.5 text-[13px] font-medium">WhatsApp customer</a>
          {finance && !sale && <LinkButton href={`/admin/crm/sales/new?order=${o.id}`} size="sm">Record sale from order</LinkButton>}
        </>} />

      {sale && <div className="mb-6"><Notice tone="info">A sale was recorded for this order on {formatDate(sale.date)}. {finance && <Link href={`/admin/crm/sales/${sale.id}`} className="font-semibold underline">Open sale →</Link>}</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Section title="Vehicle">
            {items.map(({ i, cover }) => (
              <div key={i.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg bg-mist sm:w-44">{cover && <Image src={cover} alt="" fill sizes="176px" className="object-cover" />}</div>
                <div className="flex-1">
                  {i.vehicleId ? <Link href={`/admin/vehicles/${i.vehicleId}`} className="font-display text-lg font-semibold text-ink hover:underline">{i.vehicleTitle}</Link> : <p className="font-display text-lg font-semibold">{i.vehicleTitle}</p>}
                  <KV items={[["Preferred colour", i.colorName ?? "—"], ["Quantity", i.quantity], ["Unit price", naira(i.unitPrice)], ["Line total", naira(i.lineTotal)]]} />
                </div>
              </div>
            ))}
            <div className="mt-4 flex justify-between border-t border-line pt-4"><span className="font-medium">Order total</span><span className="font-display text-xl font-semibold tabular-nums">{naira(o.total)}</span></div>
          </Section>
          <Section title="Customer" actions={<Link href={`/admin/customers/${c.id}`} className="text-sm text-muted hover:text-ink">Open in CRM →</Link>}>
            <KV items={[["Name", c.name], ["Phone", <a key="p" href={`tel:${c.phone}`} className="underline">{c.phone}</a>], ["Email", c.email ? <a key="e" href={`mailto:${c.email}`} className="underline">{c.email}</a> : "—"], ["Customer since", formatDate(c.createdAt)]]} />
            {o.message && <div className="mt-4 rounded-lg bg-mist px-4 py-3 text-sm"><p className="mb-1 text-[12px] font-medium text-muted">Message</p>{o.message}</div>}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Update order">
            <ActionForm action={updateOrder} className="space-y-4">
              <input type="hidden" name="id" value={o.id} />
              <Field label="Order status" name="status">
                <select id="status" name="status" defaultValue={o.status} className="field">{Object.entries(ORDER_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </Field>
              <Field label="Payment status" name="paymentStatus" hint="Only admins can mark an order paid. Online payment is not yet enabled.">
                <select id="paymentStatus" name="paymentStatus" defaultValue={o.paymentStatus} className="field">{Object.entries(ORDER_PAYMENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </Field>
              <SubmitButton className="w-full">Save changes</SubmitButton>
            </ActionForm>
          </Section>

          <Section title="Referral">
            {agent ? <p className="mb-3 text-sm">Referred by <strong className="text-ink">{agent.name}</strong> <span className="font-mono text-[12px] text-muted">({agent.code})</span>{ref && <span className="block text-[12px] text-stone">Attributed {formatDateTime(ref.createdAt)}</span>}</p> : <p className="mb-3 text-sm text-muted">No agent attributed.</p>}
            {can(admin, "agents") ? (
              <ActionForm action={setOrderAgent} className="flex gap-2">
                <input type="hidden" name="id" value={o.id} />
                <select name="agentId" aria-label="Agent" defaultValue={o.agentId ?? ""} className="field">
                  <option value="">No agent</option>
                  {agentList.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code}){a.status !== "approved" ? ` — ${a.status}` : ""}</option>)}
                </select>
                <SubmitButton variant="outline">Assign</SubmitButton>
              </ActionForm>
            ) : <p className="text-[12px] text-stone">Your role can&apos;t change referral attribution.</p>}
          </Section>

          <Section title="Payment">
            <p className="text-sm text-muted">Provider: <span className="text-ink">{o.paymentProvider ?? "None (online payment disabled)"}</span></p>
            <p className="mt-1 text-sm text-muted">Reference: <span className="text-ink">{o.paymentReference ?? "—"}</span></p>
            <p className="mt-3 text-[12px] text-stone">Money received outside the platform is recorded on the sale in CRM → Sales records, which supports partial payments.</p>
          </Section>

          {!sale && <ConfirmAction action={deleteOrder} fields={{ id: o.id }} label="Delete order" confirmTitle={`Delete order ${o.reference}?`} confirmBody="This removes the order and its referral record. Consider marking it Cancelled instead to keep a history." confirmLabel="Delete order" className="w-full" />}
        </div>
      </div>
    </>
  );
}
