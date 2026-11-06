import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";

/**
 * Deletes every row flagged `is_demo`, in dependency order, plus anything that
 * only exists because of demo rows (orders of demo customers, sessions of
 * demo users …). Real records are never touched.
 */
export async function removeDemoData() {
  return db.transaction(async (tx) => {
    const demoVehicles = (await tx.select({ id: s.vehicles.id }).from(s.vehicles).where(eq(s.vehicles.isDemo, true))).map((r) => r.id);
    const demoAgents = (await tx.select({ id: s.agents.id, userId: s.agents.userId }).from(s.agents).where(eq(s.agents.isDemo, true)));
    const counts = { vehicles: demoVehicles.length, agents: demoAgents.length, sales: 0 };

    // Payout expenses cascade from payouts; commissions/referrals cascade from sales/agents.
    await tx.delete(s.commissionPayouts).where(eq(s.commissionPayouts.isDemo, true));
    await tx.delete(s.agentCommissions).where(eq(s.agentCommissions.isDemo, true));
    const deletedSales = await tx.delete(s.sales).where(eq(s.sales.isDemo, true)).returning({ id: s.sales.id });
    counts.sales = deletedSales.length;
    await tx.delete(s.referrals).where(eq(s.referrals.isDemo, true));
    await tx.delete(s.orders).where(eq(s.orders.isDemo, true));
    await tx.delete(s.expenses).where(eq(s.expenses.isDemo, true));
    await tx.delete(s.vehicleAcquisitions).where(eq(s.vehicleAcquisitions.isDemo, true));
    await tx.delete(s.enquiries).where(eq(s.enquiries.isDemo, true));
    await tx.delete(s.customerNotifications).where(eq(s.customerNotifications.isDemo, true));
    // Demo customers go only if nothing real points at them.
    await tx.execute(sql`delete from customers c where c.is_demo and not exists (select 1 from orders o where o.customer_id = c.id) and not exists (select 1 from sales x where x.customer_id = c.id)`);
    if (demoAgents.length) {
      await tx.delete(s.agents).where(inArray(s.agents.id, demoAgents.map((a) => a.id)));
      await tx.delete(s.users).where(inArray(s.users.id, demoAgents.map((a) => a.userId)));
    }
    // Demo admin logins are removed only once a real, active owner exists — never lock everyone out.
    const [{ owners }] = await tx.select({ owners: sql<number>`count(*)::int` }).from(s.admins).innerJoin(s.users, eq(s.users.id, s.admins.userId))
      .where(sql`${s.admins.role} = 'owner' and ${s.users.status} = 'active' and not ${s.users.isDemo}`);
    if (owners > 0) await tx.delete(s.users).where(eq(s.users.isDemo, true));
    if (demoVehicles.length) {
      // Keep real orders/sales that reference a demo car: their FKs are set null and titles are snapshotted.
      await tx.delete(s.vehicles).where(inArray(s.vehicles.id, demoVehicles));
    }
    return counts;
  });
}

export async function demoDataCount(): Promise<number> {
  const [r] = await db.select({ n: sql<number>`(select count(*) from vehicles where is_demo) + (select count(*) from sales where is_demo) + (select count(*) from agents where is_demo) + (select count(*) from expenses where is_demo)` }).from(sql`(select 1) x`);
  return Number(r.n);
}
