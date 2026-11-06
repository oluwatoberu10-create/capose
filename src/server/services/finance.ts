import "server-only";
import { and, asc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentCommissions, agents, expenses, orders, salePayments, sales, users, vehicleAcquisitions, vehicles } from "@/db/schema";
import { grossVehicleProfit, netVehicleProfit, saleAmount } from "@/lib/finance";
import { withSaleFigures } from "./sales";

/** [from, to) as YYYY-MM-DD strings. month = 1..12, or null for the whole year. */
export function periodRange(year: number, month: number | null): { from: string; to: string } {
  if (month) {
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    return { from, to: next };
  }
  return { from: `${year}-01-01`, to: `${year + 1}-01-01` };
}

export function parsePeriod(sp: Record<string, string | string[] | undefined>, defaultMonth = true) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const y = Number(sp.year);
  const m = sp.month === "all" ? null : Number(sp.month);
  const year = Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  const month = sp.month === "all" ? null : Number.isInteger(m) && m! >= 1 && m! <= 12 ? m : defaultMonth ? now.getMonth() + 1 : null;
  return { year, month };
}

export type PeriodSummary = {
  revenue: number; acquisitionCostOfSales: number; saleExpenses: number; grossProfit: number; vehicleNetProfit: number;
  operatingExpenses: number; netProfit: number; cashReceived: number; vehiclesPurchasedCost: number; vehiclesPurchased: number;
  carsSold: number; commissionsAccrued: number;
};

export async function periodSummary(from: string, to: string): Promise<PeriodSummary> {
  const [saleRows, [opex], [cash], [acq], [comm]] = await Promise.all([
    db.select().from(sales).where(and(gte(sales.saleDate, from), lt(sales.saleDate, to))),
    db.select({ t: sql<number>`coalesce(sum(${expenses.amount}),0)::bigint` }).from(expenses).where(and(gte(expenses.spentOn, from), lt(expenses.spentOn, to))),
    db.select({ t: sql<number>`coalesce(sum(${salePayments.amount}),0)::bigint` }).from(salePayments).where(and(gte(salePayments.paidOn, from), lt(salePayments.paidOn, to))),
    db.select({ t: sql<number>`coalesce(sum(${vehicleAcquisitions.totalCost}),0)::bigint`, n: sql<number>`coalesce(sum(${vehicleAcquisitions.units}),0)::int` })
      .from(vehicleAcquisitions).where(and(gte(vehicleAcquisitions.purchaseDate, from), lt(vehicleAcquisitions.purchaseDate, to))),
    db.select({ t: sql<number>`coalesce(sum(${agentCommissions.amount}),0)::bigint` }).from(agentCommissions)
      .innerJoin(sales, eq(sales.id, agentCommissions.saleId))
      .where(and(gte(sales.saleDate, from), lt(sales.saleDate, to), ne(agentCommissions.status, "cancelled"))),
  ]);
  const revenue = saleRows.reduce((s, r) => s + saleAmount(r), 0);
  const acquisitionCostOfSales = saleRows.reduce((s, r) => s + r.acquisitionCost, 0);
  const saleExpenses = saleRows.reduce((s, r) => s + r.saleExpenses, 0);
  const grossProfit = saleRows.reduce((s, r) => s + grossVehicleProfit(r), 0);
  const vehicleNetProfit = saleRows.reduce((s, r) => s + netVehicleProfit(r), 0);
  const operatingExpenses = Number(opex.t);
  return {
    revenue, acquisitionCostOfSales, saleExpenses, grossProfit, vehicleNetProfit, operatingExpenses,
    netProfit: vehicleNetProfit - operatingExpenses, cashReceived: Number(cash.t),
    vehiclesPurchasedCost: Number(acq.t), vehiclesPurchased: Number(acq.n), carsSold: saleRows.length, commissionsAccrued: Number(comm.t),
  };
}

/** All-time balances that are not tied to a period. */
export async function outstandingBalances() {
  const all = await withSaleFigures(db, await db.select().from(sales));
  const [comm] = await db.select({
    pending: sql<number>`coalesce(sum(${agentCommissions.amount}) filter (where ${agentCommissions.status} = 'pending'),0)::bigint`,
    approved: sql<number>`coalesce(sum(${agentCommissions.amount}) filter (where ${agentCommissions.status} = 'approved'),0)::bigint`,
    paid: sql<number>`coalesce(sum(${agentCommissions.amount}) filter (where ${agentCommissions.status} = 'paid'),0)::bigint`,
  }).from(agentCommissions);
  return {
    customerOutstanding: all.reduce((s, r) => s + r.outstanding, 0),
    salesWithBalance: all.filter((r) => r.outstanding > 0).length,
    commissionsPending: Number(comm.pending),
    commissionsApproved: Number(comm.approved),
    commissionsPaid: Number(comm.paid),
    /** Liability = earned but not yet paid out. */
    commissionLiability: Number(comm.pending) + Number(comm.approved),
  };
}

export type MonthPoint = { month: number; revenue: number; expenses: number; acquisition: number; saleExpenses: number; profit: number; sold: number };

/** Twelve monthly points for a year (charts). */
export async function monthlySeries(year: number): Promise<MonthPoint[]> {
  const { from, to } = periodRange(year, null);
  const [saleRows, expRows] = await Promise.all([
    db.select().from(sales).where(and(gte(sales.saleDate, from), lt(sales.saleDate, to))),
    db.select({ m: sql<number>`extract(month from ${expenses.spentOn})::int`, t: sql<number>`sum(${expenses.amount})::bigint` })
      .from(expenses).where(and(gte(expenses.spentOn, from), lt(expenses.spentOn, to))).groupBy(sql`1`),
  ]);
  const points: MonthPoint[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0, expenses: 0, acquisition: 0, saleExpenses: 0, profit: 0, sold: 0 }));
  for (const s of saleRows) {
    const p = points[Number(s.saleDate.slice(5, 7)) - 1];
    p.revenue += saleAmount(s);
    p.acquisition += s.acquisitionCost;
    p.saleExpenses += s.saleExpenses;
    p.profit += netVehicleProfit(s);
    p.sold += 1;
  }
  for (const e of expRows) {
    const p = points[e.m - 1];
    p.expenses += Number(e.t);
    p.profit -= Number(e.t);
  }
  return points;
}

export async function inventoryCounts() {
  const [r] = await db.select({
    total: sql<number>`count(*)::int`,
    available: sql<number>`count(*) filter (where ${vehicles.availability} = 'available')::int`,
    reserved: sql<number>`count(*) filter (where ${vehicles.availability} = 'reserved')::int`,
    sold: sql<number>`count(*) filter (where ${vehicles.availability} = 'sold')::int`,
    outOfStock: sql<number>`count(*) filter (where ${vehicles.availability} = 'out_of_stock')::int`,
    units: sql<number>`coalesce(sum(${vehicles.stockQuantity}),0)::int`,
  }).from(vehicles);
  return r;
}

export async function orderCounts() {
  const [r] = await db.select({
    total: sql<number>`count(*)::int`,
    pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')::int`,
  }).from(orders);
  const [a] = await db.select({
    total: sql<number>`count(*)::int`,
    pending: sql<number>`count(*) filter (where ${agents.status} = 'pending')::int`,
  }).from(agents);
  return { orders: r.total, pendingOrders: r.pending, agents: a.total, pendingAgents: a.pending };
}

/** All-time totals for the admin overview cards. */
export async function lifetimeTotals() {
  const all = await db.select().from(sales);
  const [opex] = await db.select({ t: sql<number>`coalesce(sum(${expenses.amount}),0)::bigint` }).from(expenses);
  const [acq] = await db.select({ t: sql<number>`coalesce(sum(${vehicleAcquisitions.totalCost}),0)::bigint` }).from(vehicleAcquisitions);
  const revenue = all.reduce((s, r) => s + saleAmount(r), 0);
  const vehicleNet = all.reduce((s, r) => s + netVehicleProfit(r), 0);
  return { revenue, purchaseCosts: Number(acq.t), expenses: Number(opex.t), netProfit: vehicleNet - Number(opex.t) };
}

/* ── report rows (shared by pages and CSV export) ─────────────────────── */

export async function salesReport(from: string, to: string) {
  const rows = await db.select().from(sales).where(and(gte(sales.saleDate, from), lt(sales.saleDate, to))).orderBy(asc(sales.saleDate));
  return withSaleFigures(db, rows);
}

export async function outstandingReport() {
  const rows = await withSaleFigures(db, await db.select().from(sales).orderBy(asc(sales.saleDate)));
  return rows.filter((r) => r.outstanding > 0);
}

export async function expensesReport(from: string, to: string) {
  return db.select({ e: expenses, vehicleTitle: vehicles.title }).from(expenses).leftJoin(vehicles, eq(vehicles.id, expenses.vehicleId))
    .where(and(gte(expenses.spentOn, from), lt(expenses.spentOn, to))).orderBy(asc(expenses.spentOn));
}

export async function acquisitionsReport(from: string, to: string) {
  return db.select().from(vehicleAcquisitions).where(and(gte(vehicleAcquisitions.purchaseDate, from), lt(vehicleAcquisitions.purchaseDate, to))).orderBy(asc(vehicleAcquisitions.purchaseDate));
}

export async function commissionsReport(from: string, to: string) {
  return db.select({ c: agentCommissions, agentName: users.name, code: agents.referralCode, vehicleTitle: sales.vehicleTitle, saleDate: sales.saleDate, customerName: sales.customerName })
    .from(agentCommissions).innerJoin(sales, eq(sales.id, agentCommissions.saleId))
    .innerJoin(agents, eq(agents.id, agentCommissions.agentId)).innerJoin(users, eq(users.id, agents.userId))
    .where(and(gte(sales.saleDate, from), lt(sales.saleDate, to))).orderBy(asc(sales.saleDate));
}

