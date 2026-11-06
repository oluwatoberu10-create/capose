import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import {
  agentCommissions, agents, commissionPayouts, customers, expenses, orders, referrals, salePayments, sales, users, vehicles,
} from "@/db/schema";
import { commissionFor, COMMISSION_RATE_PERCENT, netVehicleProfit, outstanding, saleAmount, salePaymentStatus } from "@/lib/finance";
import { deductUnit, restoreUnit } from "./vehicles";
import { upsertCustomer } from "./orders";

export class SaleError extends Error {}

type PaymentMethod = "bank_transfer" | "cash" | "pos" | "online" | "other";

export type SaleInput = {
  vehicleId: string | null; vehicleTitle: string; colorId: string | null;
  customerName: string; customerPhone: string; customerEmail: string | null;
  orderId: string | null; agentId: string | null; saleDate: string;
  sellingPrice: number; discount: number; additionalIncome: number; acquisitionCost: number; saleExpenses: number;
  paymentMethod: PaymentMethod; notes: string | null;
};

/** Received-to-date per sale. */
async function receivedBySale(tx: DbOrTx, saleIds: string[]): Promise<Map<string, number>> {
  if (!saleIds.length) return new Map();
  const rows = await tx.select({ saleId: salePayments.saleId, total: sql<number>`coalesce(sum(${salePayments.amount}),0)::bigint` })
    .from(salePayments).where(inArray(salePayments.saleId, saleIds)).groupBy(salePayments.saleId);
  return new Map(rows.map((r) => [r.saleId, Number(r.total)]));
}

/** Adds total/received/outstanding/status/profit to sale rows. */
export async function withSaleFigures<T extends typeof sales.$inferSelect>(tx: DbOrTx, rows: T[]) {
  const received = await receivedBySale(tx, rows.map((r) => r.id));
  return rows.map((s) => {
    const total = saleAmount(s);
    const got = received.get(s.id) ?? 0;
    return { ...s, total, received: got, outstanding: outstanding(total, got), paymentStatus: salePaymentStatus(total, got), profit: netVehicleProfit(s) };
  });
}

/**
 * Keeps the agent commission for a sale consistent with the sale's figures.
 *  - no agent → any unpaid commission is removed;
 *  - profit ≤ 0 → no commission (an unpaid one is cancelled);
 *  - figures changed on an approved commission → back to pending for re-review;
 *  - paid commissions are never rewritten automatically.
 */
export async function syncCommission(tx: DbOrTx, saleId: string): Promise<void> {
  const [s] = await tx.select().from(sales).where(eq(sales.id, saleId)).limit(1);
  if (!s) return;
  const [existing] = await tx.select().from(agentCommissions).where(eq(agentCommissions.saleId, saleId)).limit(1);
  if (existing?.status === "paid") return;

  // Keep the referral record pointing at this sale.
  if (s.agentId) {
    const [agent] = await tx.select().from(agents).where(eq(agents.id, s.agentId)).limit(1);
    const [bySale] = await tx.select().from(referrals).where(eq(referrals.saleId, saleId)).limit(1);
    const [byOrder] = s.orderId ? await tx.select().from(referrals).where(eq(referrals.orderId, s.orderId)).limit(1) : [];
    const ref = bySale ?? byOrder;
    if (agent) {
      if (ref) await tx.update(referrals).set({ saleId, agentId: agent.id, referralCode: agent.referralCode }).where(eq(referrals.id, ref.id));
      else await tx.insert(referrals).values({ agentId: agent.id, referralCode: agent.referralCode, customerId: s.customerId, orderId: s.orderId, saleId, vehicleId: s.vehicleId, isDemo: s.isDemo });
    }
  } else {
    await tx.update(referrals).set({ saleId: null }).where(eq(referrals.saleId, saleId));
  }

  if (!s.agentId) {
    if (existing) await tx.delete(agentCommissions).where(eq(agentCommissions.id, existing.id));
    return;
  }
  const profit = netVehicleProfit(s);
  const amount = commissionFor(profit, COMMISSION_RATE_PERCENT);
  if (amount <= 0) {
    if (existing) await tx.update(agentCommissions).set({ status: "cancelled", amount: 0, profitAmount: profit, agentId: s.agentId, approvedAt: null, approvedBy: null }).where(eq(agentCommissions.id, existing.id));
    return;
  }
  if (!existing) {
    await tx.insert(agentCommissions).values({ agentId: s.agentId, saleId, profitAmount: profit, ratePercent: COMMISSION_RATE_PERCENT, amount, isDemo: s.isDemo });
    return;
  }
  const changed = existing.amount !== amount || existing.agentId !== s.agentId || existing.profitAmount !== profit;
  if (changed || existing.status === "cancelled") {
    await tx.update(agentCommissions).set({ agentId: s.agentId, profitAmount: profit, amount, status: "pending", approvedAt: null, approvedBy: null }).where(eq(agentCommissions.id, existing.id));
  }
}

export async function createSale(input: SaleInput, opts: { initialPayment: number; deductStock: boolean; isDemo?: boolean }) {
  return db.transaction(async (tx) => {
    const customer = await upsertCustomer(tx, { name: input.customerName, phone: input.customerPhone, email: input.customerEmail, source: "sale" });
    let stockDeducted = false;
    if (opts.deductStock && input.vehicleId) stockDeducted = await deductUnit(tx, input.vehicleId, input.colorId);
    const [s] = await tx.insert(sales).values({ ...input, customerId: customer.id, stockDeducted, isDemo: opts.isDemo ?? false }).returning();
    if (opts.initialPayment > 0) {
      await tx.insert(salePayments).values({ saleId: s.id, amount: opts.initialPayment, paidOn: input.saleDate, method: input.paymentMethod, notes: "Recorded with the sale" });
    }
    await syncCommission(tx, s.id);
    return s;
  });
}

export async function updateSale(id: string, input: SaleInput) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(sales).where(eq(sales.id, id)).for("update");
    if (!before) throw new SaleError("Sale not found.");
    const [commission] = await tx.select().from(agentCommissions).where(eq(agentCommissions.saleId, id)).limit(1);
    if (commission?.status === "paid" && (before.agentId !== input.agentId || netVehicleProfit(before) !== netVehicleProfit(input))) {
      throw new SaleError("The agent commission on this sale has already been paid, so its profit figures and agent can no longer change. Record an adjustment as an expense instead.");
    }
    const customer = await upsertCustomer(tx, { name: input.customerName, phone: input.customerPhone, email: input.customerEmail, source: "sale" });
    // Stock follows the vehicle/colour if they change.
    let stockDeducted = before.stockDeducted;
    if (before.stockDeducted && (before.vehicleId !== input.vehicleId || before.colorId !== input.colorId)) {
      if (before.vehicleId) await restoreUnit(tx, before.vehicleId, before.colorId);
      stockDeducted = input.vehicleId ? await deductUnit(tx, input.vehicleId, input.colorId) : false;
    }
    await tx.update(sales).set({ ...input, customerId: customer.id, stockDeducted }).where(eq(sales.id, id));
    await syncCommission(tx, id);
  });
}

export async function deleteSale(id: string) {
  await db.transaction(async (tx) => {
    const [s] = await tx.select().from(sales).where(eq(sales.id, id)).for("update");
    if (!s) return;
    const [c] = await tx.select().from(agentCommissions).where(eq(agentCommissions.saleId, id)).limit(1);
    if (c?.status === "paid") throw new SaleError("This sale has a paid agent commission and cannot be deleted.");
    if (s.stockDeducted && s.vehicleId) await restoreUnit(tx, s.vehicleId, s.colorId);
    await tx.update(referrals).set({ saleId: null }).where(eq(referrals.saleId, id));
    await tx.delete(sales).where(eq(sales.id, id));
  });
}

export async function addSalePayment(saleId: string, p: { amount: number; paidOn: string; method: PaymentMethod; reference: string | null; notes: string | null }) {
  await db.transaction(async (tx) => {
    const [s] = await tx.select().from(sales).where(eq(sales.id, saleId)).for("update");
    if (!s) throw new SaleError("Sale not found.");
    const [fig] = await withSaleFigures(tx, [s]);
    if (p.amount > fig.outstanding) throw new SaleError(`That is more than the outstanding balance of ₦${fig.outstanding.toLocaleString("en-NG")}.`);
    await tx.insert(salePayments).values({ saleId, ...p });
  });
}

export async function deleteSalePayment(paymentId: string) {
  await db.delete(salePayments).where(eq(salePayments.id, paymentId));
}

/* ── commissions ──────────────────────────────────────────────────────── */

/** Why a commission cannot be approved yet, or null when it can. */
export function approvalBlocker(c: { status: string }, sale: { paymentStatus: string; acquisitionCost: number }): string | null {
  if (c.status !== "pending") return `Only pending commissions can be approved (this one is ${c.status}).`;
  if (sale.acquisitionCost <= 0) return "Record the acquisition cost on the sale first, so the profit is real.";
  if (sale.paymentStatus !== "fully_paid") return "The sale must be fully paid (completed) before its commission can be approved.";
  return null;
}

export async function approveCommission(id: string, adminUserId: string) {
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(agentCommissions).where(eq(agentCommissions.id, id)).for("update");
    if (!c) throw new SaleError("Commission not found.");
    const [s] = await tx.select().from(sales).where(eq(sales.id, c.saleId)).limit(1);
    const [fig] = await withSaleFigures(tx, [s]);
    const blocker = approvalBlocker(c, fig);
    if (blocker) throw new SaleError(blocker);
    await tx.update(agentCommissions).set({ status: "approved", approvedAt: new Date(), approvedBy: adminUserId }).where(eq(agentCommissions.id, id));
  });
}

export async function setCommissionStatus(id: string, status: "pending" | "cancelled") {
  const [c] = await db.select().from(agentCommissions).where(eq(agentCommissions.id, id)).limit(1);
  if (!c) throw new SaleError("Commission not found.");
  if (c.status === "paid") throw new SaleError("Paid commissions cannot be changed.");
  await db.update(agentCommissions).set({ status, approvedAt: null, approvedBy: null }).where(eq(agentCommissions.id, id));
}

/**
 * Records a payout to an agent covering the chosen approved commissions,
 * marks them paid, and books the payout as an "Agent commissions" expense so
 * it flows into net profit exactly once.
 */
export async function recordPayout(input: { agentId: string; commissionIds: string[]; paidOn: string; method: PaymentMethod; reference: string | null; notes: string | null }) {
  return db.transaction(async (tx) => {
    if (!input.commissionIds.length) throw new SaleError("Choose at least one approved commission to pay.");
    const rows = await tx.select().from(agentCommissions).where(inArray(agentCommissions.id, input.commissionIds)).for("update");
    if (rows.length !== input.commissionIds.length) throw new SaleError("Some commissions could not be found.");
    if (rows.some((r) => r.agentId !== input.agentId)) throw new SaleError("All commissions in a payout must belong to the same agent.");
    if (rows.some((r) => r.status !== "approved")) throw new SaleError("Only approved commissions can be paid.");
    const amount = rows.reduce((s, r) => s + r.amount, 0);
    const [agent] = await tx.select({ name: users.name }).from(agents).innerJoin(users, eq(users.id, agents.userId)).where(eq(agents.id, input.agentId)).limit(1);
    const [payout] = await tx.insert(commissionPayouts).values({ ...input, amount }).returning();
    await tx.update(agentCommissions).set({ status: "paid", paidAt: new Date(), payoutId: payout.id }).where(inArray(agentCommissions.id, input.commissionIds));
    await tx.insert(expenses).values({
      title: `Commission payout — ${agent?.name ?? "agent"}`, category: "agent_commissions", amount, spentOn: input.paidOn,
      description: `${rows.length} commission(s)${input.reference ? `, ref ${input.reference}` : ""}`, payoutId: payout.id,
    });
    return payout;
  });
}

/** Undo a payout: commissions go back to approved and the linked expense is removed (cascade). */
export async function deletePayout(id: string) {
  await db.transaction(async (tx) => {
    await tx.update(agentCommissions).set({ status: "approved", paidAt: null, payoutId: null }).where(eq(agentCommissions.payoutId, id));
    await tx.delete(commissionPayouts).where(eq(commissionPayouts.id, id));
  });
}

/* ── read models ──────────────────────────────────────────────────────── */

export async function getSale(id: string) {
  const [s] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  if (!s) return null;
  const [fig] = await withSaleFigures(db, [s]);
  const [payments, [commission], [agent], [order], [vehicle]] = await Promise.all([
    db.select().from(salePayments).where(eq(salePayments.saleId, id)).orderBy(desc(salePayments.paidOn), desc(salePayments.createdAt)),
    db.select().from(agentCommissions).where(eq(agentCommissions.saleId, id)).limit(1),
    s.agentId ? db.select({ id: agents.id, name: users.name, code: agents.referralCode }).from(agents).innerJoin(users, eq(users.id, agents.userId)).where(eq(agents.id, s.agentId)).limit(1) : Promise.resolve([]),
    s.orderId ? db.select({ id: orders.id, reference: orders.reference }).from(orders).where(eq(orders.id, s.orderId)).limit(1) : Promise.resolve([]),
    s.vehicleId ? db.select({ id: vehicles.id, slug: vehicles.slug }).from(vehicles).where(eq(vehicles.id, s.vehicleId)).limit(1) : Promise.resolve([]),
  ]);
  return { ...fig, payments, commission: commission ?? null, agent: agent ?? null, order: order ?? null, vehicle: vehicle ?? null };
}

export async function agentOptions() {
  return db.select({ id: agents.id, name: users.name, code: agents.referralCode, status: agents.status })
    .from(agents).innerJoin(users, eq(users.id, agents.userId)).orderBy(users.name);
}

export async function customerForSale(customerId: string) {
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  return c ?? null;
}

