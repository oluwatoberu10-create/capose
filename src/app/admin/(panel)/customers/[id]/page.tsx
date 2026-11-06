import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customerNotes, customers, orders, sales, users } from "@/db/schema";
import { ActionForm, ConfirmAction, Field, SubmitButton } from "@/components/form";
import { EmptyState, ORDER_TONES, PAY_TONES, PageHeader, Section, StatCard, StatusBadge } from "@/components/ui";
import { ORDER_STATUS_LABEL, SALE_PAYMENT_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, naira, whatsappLink } from "@/lib/format";
import { addCustomerNote, deleteCustomer, deleteCustomerNote, saveCustomer } from "@/server/actions/admin-orders";
import { can, pageAdmin } from "@/server/auth";
import { withSaleFigures } from "@/server/services/sales";

export const metadata = { title: "Customer" };

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await pageAdmin("customers");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) notFound();
  const [orderRows, saleRows, notes] = await Promise.all([
    db.select({ o: orders, vehicles: sql<string>`(select string_agg(oi.vehicle_title || coalesce(' — ' || oi.color_name, ''), ', ') from order_items oi where oi.order_id = "orders"."id")` })
      .from(orders).where(eq(orders.customerId, id)).orderBy(desc(orders.createdAt)),
    db.select().from(sales).where(eq(sales.customerId, id)).orderBy(desc(sales.saleDate)),
    db.select({ n: customerNotes, author: users.name }).from(customerNotes).leftJoin(users, eq(users.id, customerNotes.authorId)).where(eq(customerNotes.customerId, id)).orderBy(desc(customerNotes.createdAt)),
  ]);
  const purchases = await withSaleFigures(db, saleRows);
  const spent = purchases.reduce((s, p) => s + p.total, 0);
  const owed = purchases.reduce((s, p) => s + p.outstanding, 0);
  const finance = can(admin, "finance");

  return (
    <>
      <PageHeader title={c.name} back={{ href: "/admin/customers", label: "Customers" }} subtitle={`Customer since ${formatDate(c.createdAt)} · source: ${c.source}`}
        actions={<a href={whatsappLink(c.phone, `Hello ${c.name.split(" ")[0]},`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3.5 text-[13px] font-medium">WhatsApp</a>} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Orders placed" value={orderRows.length} />
        <StatCard label="Cars purchased" value={purchases.length} />
        <StatCard label="Total spent" value={naira(spent)} tone="dark" />
        <StatCard label="Outstanding balance" value={naira(owed)} tone={owed > 0 ? "bad" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Section title="Vehicles requested">
            {orderRows.length ? (
              <ul className="-my-2 divide-y divide-line">
                {orderRows.map(({ o, vehicles }) => (
                  <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div><p className="font-medium text-ink">{vehicles}</p><p className="text-[12px] text-muted">{o.reference} · {formatDate(o.createdAt)}</p></div>
                    <div className="flex items-center gap-2"><span className="tabular-nums">{naira(o.total)}</span><StatusBadge value={o.status} map={ORDER_TONES} labels={ORDER_STATUS_LABEL} /></div>
                  </Link></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No website orders.</p>}
          </Section>
          <Section title="Purchase history" actions={finance ? <Link href={`/admin/crm/sales/new?customer=${c.id}`} className="text-sm text-muted hover:text-ink">+ Record sale</Link> : undefined}>
            {purchases.length ? (
              <ul className="-my-2 divide-y divide-line">
                {purchases.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>{finance ? <Link href={`/admin/crm/sales/${p.id}`} className="font-medium text-ink hover:underline">{p.vehicleTitle}</Link> : <p className="font-medium text-ink">{p.vehicleTitle}</p>}<p className="text-[12px] text-muted">{formatDate(p.saleDate)} · paid {naira(p.received)} of {naira(p.total)}</p></div>
                    <StatusBadge value={p.paymentStatus} map={PAY_TONES} labels={SALE_PAYMENT_LABEL} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No recorded purchases yet.</p>}
          </Section>
          <Section title="Notes">
            <ActionForm action={addCustomerNote} resetOnSuccess className="space-y-2">
              <input type="hidden" name="customerId" value={c.id} />
              <Field label="Add a note" name="body"><textarea id="body" name="body" rows={3} className="field" placeholder="Call summary, preferences, follow-up date…" /></Field>
              <SubmitButton size="sm">Save note</SubmitButton>
            </ActionForm>
            {notes.length ? (
              <ul className="mt-5 space-y-3">
                {notes.map(({ n, author }) => (
                  <li key={n.id} className="rounded-lg bg-mist/70 px-4 py-3 text-sm">
                    <p className="whitespace-pre-wrap text-body">{n.body}</p>
                    <div className="mt-2 flex items-center justify-between text-[12px] text-stone"><span>{author ?? "System"} · {formatDateTime(n.createdAt)}</span>
                      <ConfirmAction action={deleteCustomerNote} fields={{ id: n.id }} label="Delete" variant="ghost" confirmTitle="Delete this note?" confirmLabel="Delete note" /></div>
                  </li>
                ))}
              </ul>
            ) : <div className="mt-4"><EmptyState title="No notes yet" /></div>}
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Details">
            <ActionForm action={saveCustomer} className="space-y-4">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Full name" name="name"><input id="name" name="name" defaultValue={c.name} className="field" /></Field>
              <Field label="Phone" name="phone"><input id="phone" name="phone" defaultValue={c.phone} className="field" /></Field>
              <Field label="Email" name="email"><input id="email" name="email" type="email" defaultValue={c.email ?? ""} className="field" /></Field>
              <SubmitButton className="w-full">Save details</SubmitButton>
            </ActionForm>
          </Section>
          {orderRows.length === 0 && purchases.length === 0 && (
            <ConfirmAction action={deleteCustomer} fields={{ id: c.id }} label="Delete customer" className="w-full" confirmTitle={`Delete ${c.name}?`} confirmBody="This removes the customer and their notes." confirmLabel="Delete customer" />
          )}
        </div>
      </div>
    </>
  );
}
