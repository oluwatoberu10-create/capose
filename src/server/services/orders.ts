import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { agents, customers, orderItems, orders, referrals, vehicleColors, vehicles } from "@/db/schema";
import { isOrderable, publicPrice, type Availability } from "@/lib/finance";
import { generateToken } from "@/lib/crypto";
import { phoneKey } from "@/lib/format";

export class OrderError extends Error {}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function newOrderReference(now = new Date()): string {
  const d = now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }).slice(2).replace(/-/g, "");
  const bytes = randomBytes(5);
  const tail = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `AM-${d}-${tail}`;
}

/** Finds a customer by phone number (any common Nigerian format) or creates one. */
export async function upsertCustomer(tx: DbOrTx, c: { name: string; phone: string; email?: string | null; source?: string }) {
  const key = phoneKey(c.phone);
  const [existing] = await tx.select().from(customers).where(eq(customers.phoneKey, key)).limit(1);
  if (existing) {
    const patch: Partial<typeof customers.$inferInsert> = {};
    if (!existing.email && c.email) patch.email = c.email;
    if (Object.keys(patch).length) await tx.update(customers).set(patch).where(eq(customers.id, existing.id));
    return existing;
  }
  const [created] = await tx.insert(customers).values({ name: c.name, phone: c.phone, phoneKey: key, email: c.email || null, source: c.source ?? "order" }).returning();
  return created;
}

/** The approved agent that owns a referral code, or null. */
export async function agentForCode(tx: DbOrTx, code: string | null | undefined) {
  const clean = code?.trim().toUpperCase();
  if (!clean || !/^[A-Z0-9]{4,16}$/.test(clean)) return null;
  const [a] = await tx.select({ id: agents.id, code: agents.referralCode }).from(agents)
    .where(and(eq(agents.referralCode, clean), eq(agents.status, "approved"))).limit(1);
  return a ?? null;
}

export type OrderInput = {
  vehicleId: string; colorId: string | null; quantity: number;
  name: string; phone: string; email: string | null; message: string | null; referralCode: string | null;
};

/**
 * Creates an order request: customer (CRM), order, line item and — when the
 * visitor arrived through an agent link — the referral attribution.
 * Payment stays "pending"; nothing is charged.
 */
export async function createOrder(input: OrderInput) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select({
      id: vehicles.id, title: vehicles.title, price: vehicles.price, discountPrice: vehicles.discountPrice,
      availability: vehicles.availability, stock: vehicles.stockQuantity, published: vehicles.published,
    }).from(vehicles).where(eq(vehicles.id, input.vehicleId)).for("update");
    if (!v || !v.published) throw new OrderError("This vehicle is no longer listed.");
    if (!isOrderable(v.availability as Availability)) throw new OrderError("This vehicle is not available to order right now.");

    const colors = await tx.select().from(vehicleColors).where(eq(vehicleColors.vehicleId, v.id));
    let color: (typeof colors)[number] | undefined;
    if (colors.length) {
      color = colors.find((c) => c.id === input.colorId);
      if (!color) throw new OrderError("Please choose one of the available colours.");
      if (color.stockQuantity !== null && color.stockQuantity < input.quantity) {
        throw new OrderError(color.stockQuantity === 0 ? `${color.name} is out of stock.` : `Only ${color.stockQuantity} in ${color.name} available.`);
      }
    }
    if (input.quantity > v.stock) throw new OrderError(`Only ${v.stock} available.`);

    const unit = publicPrice(v).price;
    const customer = await upsertCustomer(tx, { name: input.name, phone: input.phone, email: input.email });
    const agent = await agentForCode(tx, input.referralCode);

    let reference = newOrderReference();
    for (let i = 0; i < 5; i++) {
      const [clash] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.reference, reference)).limit(1);
      if (!clash) break;
      reference = newOrderReference();
    }

    const total = unit * input.quantity;
    const [order] = await tx.insert(orders).values({
      reference, accessToken: generateToken(24), customerId: customer.id, subtotal: total, total,
      message: input.message, agentId: agent?.id ?? null, referralCode: agent?.code ?? null,
    }).returning();
    await tx.insert(orderItems).values({
      orderId: order.id, vehicleId: v.id, colorId: color?.id ?? null, vehicleTitle: v.title, colorName: color?.name ?? null,
      quantity: input.quantity, unitPrice: unit, lineTotal: total,
    });
    if (agent) {
      await tx.insert(referrals).values({ agentId: agent.id, referralCode: agent.code, customerId: customer.id, orderId: order.id, vehicleId: v.id });
    }
    return order;
  });
}

export async function getOrderByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const [o] = await db.select({ order: orders, customer: customers }).from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId)).where(eq(orders.accessToken, token)).limit(1);
  if (!o) return null;
  const items = await db.select({
    item: orderItems, slug: vehicles.slug,
    cover: sql<string | null>`(select vi.url from vehicle_images vi where vi.vehicle_id = "order_items"."vehicle_id" order by vi.is_featured desc, vi.position limit 1)`,
  }).from(orderItems).leftJoin(vehicles, eq(vehicles.id, orderItems.vehicleId)).where(eq(orderItems.orderId, o.order.id));
  return { ...o, items };
}

/**
 * Admin re-assigns (or clears) the agent credited for an order. Keeps the
 * referral row in step so the agent's dashboard matches.
 */
export async function assignOrderAgent(orderId: string, agentId: string | null) {
  await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) throw new OrderError("Order not found.");
    if (!agentId) {
      await tx.update(orders).set({ agentId: null, referralCode: null }).where(eq(orders.id, orderId));
      await tx.delete(referrals).where(eq(referrals.orderId, orderId));
      return;
    }
    const [a] = await tx.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    if (!a) throw new OrderError("Agent not found.");
    const [item] = await tx.select({ vehicleId: orderItems.vehicleId }).from(orderItems).where(eq(orderItems.orderId, orderId)).limit(1);
    await tx.update(orders).set({ agentId: a.id, referralCode: a.referralCode }).where(eq(orders.id, orderId));
    const [ref] = await tx.select().from(referrals).where(eq(referrals.orderId, orderId)).limit(1);
    if (ref) await tx.update(referrals).set({ agentId: a.id, referralCode: a.referralCode }).where(eq(referrals.id, ref.id));
    else await tx.insert(referrals).values({ agentId: a.id, referralCode: a.referralCode, customerId: o.customerId, orderId, vehicleId: item?.vehicleId ?? null });
  });
}
