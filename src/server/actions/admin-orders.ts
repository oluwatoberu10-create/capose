"use server";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { customerNotes, customerNotifications, customers, enquiries, orders, sales } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { phoneKey } from "@/lib/format";
import { requireAdmin } from "@/server/auth";
import { assignOrderAgent } from "@/server/services/orders";
import { formObject, run, UserError, zId, zOptEmail, zOptId, zOptText, zPhone, zText } from "./util";

const orderUpdate = z.object({
  id: zId,
  status: z.enum(["pending", "confirmed", "processing", "completed", "cancelled"]),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]),
});

export async function updateOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("orders");
    const v = orderUpdate.parse(formObject(fd));
    const [o] = await db.update(orders).set({ status: v.status, paymentStatus: v.paymentStatus }).where(eq(orders.id, v.id)).returning({ id: orders.id });
    if (!o) throw new UserError("Order not found.");
    return "Order updated.";
  });
}

export async function setOrderAgent(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("agents");
    const id = zId.parse(fd.get("id"));
    const agentId = zOptId.parse(fd.get("agentId") ?? "");
    await assignOrderAgent(id, agentId);
    return agentId ? "Referral agent assigned." : "Referral agent removed.";
  });
}

export async function deleteOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const r = await run(async () => {
    await requireAdmin("orders");
    const id = zId.parse(fd.get("id"));
    const [linked] = await db.select({ id: sales.id }).from(sales).where(eq(sales.orderId, id)).limit(1);
    if (linked) throw new UserError("A sale is recorded against this order. Cancel the order instead.");
    await db.delete(orders).where(eq(orders.id, id));
    done = true;
  });
  if (done) redirect("/admin/orders?deleted=1");
  return r;
}

/* ── customers ────────────────────────────────────────────────────────── */

const customerSchema = z.object({ id: z.string().optional(), name: zText("Name", 120), phone: zPhone, email: zOptEmail });

export async function saveCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  const r = await run(async () => {
    await requireAdmin("customers");
    const v = customerSchema.parse(formObject(fd));
    const key = phoneKey(v.phone);
    const [clash] = await db.select({ id: customers.id }).from(customers).where(eq(customers.phoneKey, key)).limit(1);
    if (clash && clash.id !== v.id) return { ok: false, message: "Another customer already has this phone number.", errors: { phone: "Already used by another customer." } };
    if (v.id) {
      await db.update(customers).set({ name: v.name, phone: v.phone, phoneKey: key, email: v.email }).where(eq(customers.id, zId.parse(v.id)));
      return "Customer updated.";
    }
    const [c] = await db.insert(customers).values({ name: v.name, phone: v.phone, phoneKey: key, email: v.email, source: "manual" }).returning();
    createdId = c.id;
  });
  if (createdId) redirect(`/admin/customers/${createdId}`);
  return r;
}

export async function addCustomerNote(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await requireAdmin("customers");
    const customerId = zId.parse(fd.get("customerId"));
    const body = zText("Note", 4000).parse(fd.get("body") ?? "");
    await db.insert(customerNotes).values({ customerId, body, authorId: admin.userId });
    return "Note added.";
  });
}

export async function deleteCustomerNote(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("customers");
    await db.delete(customerNotes).where(eq(customerNotes.id, zId.parse(fd.get("id"))));
    return "Note deleted.";
  });
}

export async function deleteCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const r = await run(async () => {
    await requireAdmin("customers");
    const id = zId.parse(fd.get("id"));
    const [{ n }] = await db.select({ n: sql<number>`(select count(*) from orders where customer_id = ${id}) + (select count(*) from sales where customer_id = ${id})` }).from(customers).where(eq(customers.id, id));
    if (Number(n) > 0) throw new UserError("This customer has orders or sales and cannot be deleted.");
    await db.delete(customers).where(eq(customers.id, id));
    done = true;
  });
  if (done) redirect("/admin/customers");
  return r;
}

/* ── enquiries & notify requests ─────────────────────────────────────── */

export async function setEnquiryStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("enquiries");
    const id = zId.parse(fd.get("id"));
    const status = z.enum(["new", "handled"]).parse(fd.get("status"));
    await db.update(enquiries).set({ status }).where(eq(enquiries.id, id));
    return status === "handled" ? "Marked as handled." : "Marked as new.";
  });
}

export async function setNotifyStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("enquiries");
    const id = zId.parse(fd.get("id"));
    const status = z.enum(["waiting", "notified"]).parse(fd.get("status"));
    await db.update(customerNotifications).set({ status }).where(eq(customerNotifications.id, id));
    return status === "notified" ? "Marked as notified." : "Moved back to waiting.";
  });
}

export async function deleteEnquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("enquiries");
    const id = zId.parse(fd.get("id"));
    const kind = z.enum(["enquiry", "notify"]).parse(fd.get("kind"));
    if (kind === "enquiry") await db.delete(enquiries).where(eq(enquiries.id, id));
    else await db.delete(customerNotifications).where(eq(customerNotifications.id, id));
    return "Deleted.";
  });
}

/** Turns an enquiry into a CRM customer (or finds the existing one). */
export async function enquiryToCustomer(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string | null = null;
  const r = await run(async () => {
    await requireAdmin("customers");
    const e = z.object({ name: zText("Name"), phone: zPhone, email: zOptEmail, note: zOptText(4000) }).parse(formObject(fd));
    const key = phoneKey(e.phone);
    const [existing] = await db.select().from(customers).where(eq(customers.phoneKey, key)).limit(1);
    const c = existing ?? (await db.insert(customers).values({ name: e.name, phone: e.phone, phoneKey: key, email: e.email, source: "enquiry" }).returning())[0];
    if (e.note) await db.insert(customerNotes).values({ customerId: c.id, body: `Enquiry: ${e.note}` });
    id = c.id;
  });
  if (id) redirect(`/admin/customers/${id}`);
  return r;
}
