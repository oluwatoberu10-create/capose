import "server-only";
import { randomBytes } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentCommissions, agents, customers, orders, referralVisits, referrals, sales, users, vehicles } from "@/db/schema";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** e.g. "ADA" + 5 random → ADA7K2QM. Prefix from the agent's name keeps codes recognisable. */
export async function newReferralCode(name: string): Promise<string> {
  const prefix = (name.normalize("NFKD").replace(/[^A-Za-z]/g, "").toUpperCase() + "AGT").slice(0, 3);
  for (let i = 0; i < 10; i++) {
    const tail = Array.from(randomBytes(5), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    const code = `${prefix}${tail}`;
    const [clash] = await db.select({ id: agents.id }).from(agents).where(eq(agents.referralCode, code)).limit(1);
    if (!clash) return code;
  }
  throw new Error("Could not allocate a referral code");
}

/** Headline numbers for one agent. Always scoped by agentId — callers pass the signed-in agent's own id. */
export async function agentStats(agentId: string) {
  const [[r], [c], [v]] = await Promise.all([
    db.select({
      referrals: sql<number>`count(*)::int`,
      sales: sql<number>`count(${referrals.saleId})::int`,
    }).from(referrals).where(eq(referrals.agentId, agentId)),
    db.select({
      earned: sql<number>`coalesce(sum(${agentCommissions.amount}) filter (where ${agentCommissions.status} in ('pending','approved','paid')),0)::bigint`,
      pending: sql<number>`coalesce(sum(${agentCommissions.amount}) filter (where ${agentCommissions.status} = 'pending'),0)::bigint`,
      approved: sql<number>`coalesce(sum(${agentCommissions.amount}) filter (where ${agentCommissions.status} = 'approved'),0)::bigint`,
      paid: sql<number>`coalesce(sum(${agentCommissions.amount}) filter (where ${agentCommissions.status} = 'paid'),0)::bigint`,
    }).from(agentCommissions).where(eq(agentCommissions.agentId, agentId)),
    db.select({ visits: sql<number>`count(*)::int` }).from(referralVisits).where(eq(referralVisits.agentId, agentId)),
  ]);
  return {
    referrals: r.referrals, successfulSales: r.sales, visits: v.visits,
    earned: Number(c.earned), pending: Number(c.pending), approved: Number(c.approved), paid: Number(c.paid),
  };
}

/**
 * Referral history for one agent. Customer names are shown as first name +
 * initial and phone numbers are never included — agents see who they
 * referred, not the dealership's customer records.
 */
export async function agentReferralHistory(agentId: string, opts: { full?: boolean } = {}) {
  const rows = await db.select({
    id: referrals.id, createdAt: referrals.createdAt, customerName: customers.name, customerPhone: customers.phone,
    vehicleTitle: sql<string | null>`coalesce(${sales.vehicleTitle}, ${vehicles.title})`, vehicleSlug: vehicles.slug,
    orderReference: orders.reference, orderStatus: orders.status, saleId: referrals.saleId, saleDate: sales.saleDate,
    commissionAmount: agentCommissions.amount, commissionStatus: agentCommissions.status, profitAmount: agentCommissions.profitAmount,
  }).from(referrals)
    .leftJoin(customers, eq(customers.id, referrals.customerId))
    .leftJoin(orders, eq(orders.id, referrals.orderId))
    .leftJoin(sales, eq(sales.id, referrals.saleId))
    .leftJoin(vehicles, eq(vehicles.id, referrals.vehicleId))
    .leftJoin(agentCommissions, eq(agentCommissions.saleId, referrals.saleId))
    .where(eq(referrals.agentId, agentId)).orderBy(desc(referrals.createdAt)).limit(200);
  return rows.map((r) => ({
    ...r,
    customerName: opts.full ? r.customerName : maskName(r.customerName),
    customerPhone: opts.full ? r.customerPhone : null,
    profitAmount: opts.full ? r.profitAmount : null,
  }));
}

export function maskName(name: string | null): string {
  if (!name) return "—";
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export async function recentVisits(agentId: string, limit = 10) {
  return db.select({ path: referralVisits.path, createdAt: referralVisits.createdAt, vehicleTitle: vehicles.title })
    .from(referralVisits).leftJoin(vehicles, eq(vehicles.id, referralVisits.vehicleId))
    .where(eq(referralVisits.agentId, agentId)).orderBy(desc(referralVisits.createdAt)).limit(limit);
}

/** Admin list with performance and balances. */
export async function listAgentsWithStats() {
  const rows = await db.select({
    id: agents.id, name: users.name, email: users.email, phone: users.phone, status: agents.status, code: agents.referralCode,
    createdAt: agents.createdAt, userStatus: users.status, isDemo: agents.isDemo,
    referrals: sql<number>`(select count(*)::int from referrals r where r.agent_id = "agents"."id")`,
    sales: sql<number>`(select count(r.sale_id)::int from referrals r where r.agent_id = "agents"."id")`,
    pending: sql<number>`(select coalesce(sum(amount),0)::bigint from agent_commissions c where c.agent_id = "agents"."id" and c.status = 'pending')`,
    approved: sql<number>`(select coalesce(sum(amount),0)::bigint from agent_commissions c where c.agent_id = "agents"."id" and c.status = 'approved')`,
    paid: sql<number>`(select coalesce(sum(amount),0)::bigint from agent_commissions c where c.agent_id = "agents"."id" and c.status = 'paid')`,
  }).from(agents).innerJoin(users, eq(users.id, agents.userId)).orderBy(sql`${agents.status} = 'pending' desc`, desc(agents.createdAt));
  return rows.map((r) => ({ ...r, pending: Number(r.pending), approved: Number(r.approved), paid: Number(r.paid) }));
}

export async function logReferralVisit(code: string, path: string, vehicleSlug: string | null) {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(clean)) return false;
  const [a] = await db.select({ id: agents.id, status: agents.status }).from(agents).where(eq(agents.referralCode, clean)).limit(1);
  if (!a || a.status !== "approved") return false;
  let vehicleId: string | null = null;
  if (vehicleSlug) {
    const [v] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.slug, vehicleSlug)).limit(1);
    vehicleId = v?.id ?? null;
  }
  await db.insert(referralVisits).values({ agentId: a.id, vehicleId, path: path.slice(0, 200) });
  return true;
}
