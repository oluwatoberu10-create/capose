import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customerNotifications, enquiries, vehicles } from "@/db/schema";
import { ActionForm, ConfirmAction, InlineAction, SubmitButton } from "@/components/form";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { formatDateTime, whatsappLink } from "@/lib/format";
import { deleteEnquiry, enquiryToCustomer, setEnquiryStatus, setNotifyStatus } from "@/server/actions/admin-orders";
import { pageAdmin } from "@/server/auth";

export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await pageAdmin("enquiries");
  const { tab } = await searchParams;
  const notify = tab === "notify";
  const [enq, waits] = await Promise.all([
    db.select({ e: enquiries, title: vehicles.title, vid: vehicles.id }).from(enquiries).leftJoin(vehicles, eq(vehicles.id, enquiries.vehicleId)).orderBy(enquiries.status, desc(enquiries.createdAt)).limit(200),
    db.select({ n: customerNotifications, title: vehicles.title, vid: vehicles.id, availability: vehicles.availability }).from(customerNotifications).innerJoin(vehicles, eq(vehicles.id, customerNotifications.vehicleId)).orderBy(customerNotifications.status, desc(customerNotifications.createdAt)).limit(200),
  ]);
  const tabCls = (on: boolean) => `rounded-lg px-4 py-2 text-sm font-medium ${on ? "bg-ink text-white" : "text-muted hover:bg-white"}`;

  return (
    <>
      <PageHeader title="Enquiries" subtitle="Contact form messages, “request more information” and “notify me when available” requests." />
      <div className="mb-5 inline-flex gap-1 rounded-xl bg-mist p-1">
        <Link href="/admin/enquiries" className={tabCls(!notify)}>Messages ({enq.filter((x) => x.e.status === "new").length} new)</Link>
        <Link href="/admin/enquiries?tab=notify" className={tabCls(notify)}>Notify requests ({waits.filter((x) => x.n.status === "waiting").length})</Link>
      </div>
      {!notify ? (enq.length ? (
        <ul className="space-y-3">
          {enq.map(({ e, title, vid }) => (
            <li key={e.id} className={`card p-4 sm:p-5 ${e.status === "handled" ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{e.name} {e.status === "new" && <Badge tone="gold">New</Badge>}</p>
                  <p className="text-[13px] text-muted">{[e.phone, e.email].filter(Boolean).join(" · ")} · {formatDateTime(e.createdAt)}</p>
                  {title && <p className="mt-1 text-[13px]">About: <Link href={`/admin/vehicles/${vid}`} className="font-medium text-ink underline">{title}</Link></p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {e.phone && <a href={whatsappLink(e.phone, `Hello ${e.name.split(" ")[0]}, thanks for contacting us.`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[13px]">WhatsApp</a>}
                  {e.email && <a href={`mailto:${e.email}`} className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[13px]">Email</a>}
                  {e.phone && (
                    <ActionForm action={enquiryToCustomer}>
                      {Object.entries({ name: e.name, phone: e.phone, email: e.email ?? "", note: e.message }).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                      <SubmitButton variant="outline" size="sm">Add to CRM</SubmitButton>
                    </ActionForm>
                  )}
                  <InlineAction action={setEnquiryStatus} fields={{ id: e.id, status: e.status === "new" ? "handled" : "new" }}>{e.status === "new" ? "Mark handled" : "Mark new"}</InlineAction>
                  <ConfirmAction action={deleteEnquiry} fields={{ id: e.id, kind: "enquiry" }} label="Delete" variant="ghost" confirmTitle="Delete this message?" confirmLabel="Delete" />
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-mist/70 px-4 py-3 text-sm text-body">{e.message}</p>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No messages yet" body="Messages from the contact form and car pages appear here." />) : (waits.length ? (
        <ul className="space-y-3">
          {waits.map(({ n, title, vid, availability }) => (
            <li key={n.id} className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${n.status === "notified" ? "opacity-70" : ""}`}>
              <div>
                <p className="font-medium text-ink">{n.name} <span className="font-normal text-muted">— {n.phone}{n.email ? ` · ${n.email}` : ""}</span></p>
                <p className="text-[13px] text-muted">Wants <Link href={`/admin/vehicles/${vid}`} className="font-medium text-ink underline">{title}</Link> · {formatDateTime(n.createdAt)}</p>
                {availability === "available" && n.status === "waiting" && <Badge tone="ok" className="mt-1.5">Car is available again — let them know</Badge>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <a href={whatsappLink(n.phone, `Hello ${n.name.split(" ")[0]}, good news — the ${title} is available again.`)} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[13px]">WhatsApp</a>
                <InlineAction action={setNotifyStatus} fields={{ id: n.id, status: n.status === "waiting" ? "notified" : "waiting" }}>{n.status === "waiting" ? "Mark notified" : "Undo"}</InlineAction>
                <ConfirmAction action={deleteEnquiry} fields={{ id: n.id, kind: "notify" }} label="Delete" variant="ghost" confirmTitle="Delete this request?" confirmLabel="Delete" />
              </div>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No notify requests" body="When a car is out of stock, customers can ask to be told when it's back." />)}
    </>
  );
}
