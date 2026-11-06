/**
 * End-to-end business rules against a real database: ordering, stock,
 * referral attribution, profit, commissions, payouts and finance totals.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as S from "@/db/schema";
import { createOrder, OrderError } from "@/server/services/orders";
import { addSalePayment, approveCommission, createSale, deleteSale, recordPayout, SaleError, updateSale, type SaleInput } from "@/server/services/sales";
import { getPublicVehicle, listPublicVehicles, parseInventoryFilters, syncVehicleStock } from "@/server/services/vehicles";
import { outstandingBalances, periodSummary } from "@/server/services/finance";
import { agentReferralHistory, agentStats } from "@/server/services/agents";
import { removeDemoData } from "@/server/services/demo";

let vehicleId: string;
let silverId: string;
let whiteId: string;
let agentId: string;
let adminId: string;

async function makeVehicle(over: Partial<typeof S.vehicles.$inferInsert> = {}) {
  const [v] = await db.insert(S.vehicles).values({
    slug: `car-${Math.random().toString(36).slice(2)}`, title: "2023 Toyota Camry", brand: "Toyota", model: "Camry", year: 2023,
    stockNumber: `T-${Math.random().toString(36).slice(2, 8)}`, condition: "foreign_used", price: 23_000_000,
    purchaseCost: 20_000_000, additionalExpenses: 500_000, stockQuantity: 2, ...over,
  }).returning();
  return v;
}

const saleInput = (over: Partial<SaleInput> = {}): SaleInput => ({
  vehicleId, vehicleTitle: "2023 Toyota Camry", colorId: null, customerName: "Ngozi Test", customerPhone: "0803 123 4567", customerEmail: null,
  orderId: null, agentId, saleDate: "2026-10-15", sellingPrice: 23_000_000, discount: 0, additionalIncome: 0,
  acquisitionCost: 20_500_000, saleExpenses: 0, paymentMethod: "bank_transfer", notes: null, ...over,
});

beforeAll(async () => {
  const v = await makeVehicle();
  vehicleId = v.id;
  const colors = await db.insert(S.vehicleColors).values([
    { vehicleId, name: "Silver", stockQuantity: 2, position: 0 },
    { vehicleId, name: "White", stockQuantity: 0, position: 1 },
  ]).returning();
  silverId = colors[0].id;
  whiteId = colors[1].id;
  await syncVehicleStock(db, vehicleId);

  const [u] = await db.insert(S.users).values({ email: "agent@test.test", name: "Ada Agent", role: "agent", passwordHash: "x" }).returning();
  const [a] = await db.insert(S.agents).values({ userId: u.id, referralCode: "ADATEST1", status: "approved" }).returning();
  agentId = a.id;
  const [adm] = await db.insert(S.users).values({ email: "owner@test.test", name: "Owner", role: "admin", passwordHash: "x" }).returning();
  await db.insert(S.admins).values({ userId: adm.id, role: "owner" });
  adminId = adm.id;
});

describe("public inventory", () => {
  it("never exposes internal costs", async () => {
    const v = await getPublicVehicle((await db.select().from(S.vehicles).where(eq(S.vehicles.id, vehicleId)))[0].slug);
    expect(v).not.toBeNull();
    expect(v).not.toHaveProperty("purchaseCost");
    expect(v).not.toHaveProperty("additionalExpenses");
    const list = await listPublicVehicles(parseInventoryFilters({}));
    expect(list.items[0]).not.toHaveProperty("purchaseCost");
  });
  it("filters by price and brand", async () => {
    expect((await listPublicVehicles(parseInventoryFilters({ brand: "toyota", priceMax: "25000000" }))).total).toBeGreaterThan(0);
    expect((await listPublicVehicles(parseInventoryFilters({ priceMin: "90000000" }))).total).toBe(0);
  });
  it("vehicle stock follows tracked colour stock", async () => {
    const [v] = await db.select().from(S.vehicles).where(eq(S.vehicles.id, vehicleId));
    expect(v.stockQuantity).toBe(2);
    expect(v.availability).toBe("available");
  });
});

describe("orders", () => {
  it("creates a pending order with a reference, a CRM customer and referral attribution", async () => {
    const o = await createOrder({ vehicleId, colorId: silverId, quantity: 1, name: "Kemi Buyer", phone: "0805 000 1111", email: null, message: null, referralCode: "adatest1" });
    expect(o.reference).toMatch(/^AM-\d{6}-[A-Z2-9]{5}$/);
    expect(o.status).toBe("pending");
    expect(o.paymentStatus).toBe("pending");
    expect(o.total).toBe(23_000_000);
    expect(o.agentId).toBe(agentId);
    const [ref] = await db.select().from(S.referrals).where(eq(S.referrals.orderId, o.id));
    expect(ref.agentId).toBe(agentId);
    expect(ref.vehicleId).toBe(vehicleId);
    expect((await db.select().from(S.customers).where(eq(S.customers.id, o.customerId))).length).toBe(1);
  });
  it("ignores codes of unapproved or unknown agents", async () => {
    const o = await createOrder({ vehicleId, colorId: silverId, quantity: 1, name: "No Ref", phone: "0805 000 2222", email: null, message: null, referralCode: "NOPE1234" });
    expect(o.agentId).toBeNull();
  });
  it("matches a returning customer by phone in any format", async () => {
    const a = await createOrder({ vehicleId, colorId: silverId, quantity: 1, name: "Repeat", phone: "08051112233", email: null, message: null, referralCode: null });
    const b = await createOrder({ vehicleId, colorId: silverId, quantity: 1, name: "Repeat", phone: "+234 805 111 2233", email: "r@x.com", message: null, referralCode: null });
    expect(a.customerId).toBe(b.customerId);
  });
  it("refuses out-of-stock colours, excess quantity and unavailable cars", async () => {
    await expect(createOrder({ vehicleId, colorId: whiteId, quantity: 1, name: "X", phone: "0805 000 3333", email: null, message: null, referralCode: null })).rejects.toBeInstanceOf(OrderError);
    await expect(createOrder({ vehicleId, colorId: silverId, quantity: 3, name: "X", phone: "0805 000 3333", email: null, message: null, referralCode: null })).rejects.toBeInstanceOf(OrderError);
    const out = await makeVehicle({ stockQuantity: 0, availability: "out_of_stock" });
    await expect(createOrder({ vehicleId: out.id, colorId: null, quantity: 1, name: "X", phone: "0805 000 3333", email: null, message: null, referralCode: null })).rejects.toThrow(/not available/);
  });
});

describe("sales, commissions and payouts", () => {
  it("spec example: 10% of ₦2.5M profit = ₦250,000, pending until approved", async () => {
    const s = await createSale(saleInput(), { initialPayment: 23_000_000, deductStock: true });
    const [c] = await db.select().from(S.agentCommissions).where(eq(S.agentCommissions.saleId, s.id));
    expect(c.profitAmount).toBe(2_500_000);
    expect(c.amount).toBe(250_000);
    expect(c.status).toBe("pending");
    // Stock deducted, sold count up, and the colour-less sale took a unit from the vehicle.
    const [v] = await db.select().from(S.vehicles).where(eq(S.vehicles.id, vehicleId));
    expect(v.soldQuantity).toBe(1);
  });

  it("no commission without positive profit", async () => {
    const s = await createSale(saleInput({ sellingPrice: 20_000_000 }), { initialPayment: 0, deductStock: false });
    expect(await db.select().from(S.agentCommissions).where(eq(S.agentCommissions.saleId, s.id))).toHaveLength(0);
  });

  it("approval needs a fully paid sale with an acquisition cost; payout marks paid and books one expense", async () => {
    const s = await createSale(saleInput({ saleDate: "2026-09-10" }), { initialPayment: 10_000_000, deductStock: false });
    const [c] = await db.select().from(S.agentCommissions).where(eq(S.agentCommissions.saleId, s.id));
    await expect(approveCommission(c.id, adminId)).rejects.toThrow(/fully paid/);
    await addSalePayment(s.id, { amount: 13_000_000, paidOn: "2026-09-20", method: "cash", reference: null, notes: null });
    await expect(addSalePayment(s.id, { amount: 1, paidOn: "2026-09-21", method: "cash", reference: null, notes: null })).rejects.toBeInstanceOf(SaleError);
    await approveCommission(c.id, adminId);
    const p = await recordPayout({ agentId, commissionIds: [c.id], paidOn: "2026-09-25", method: "bank_transfer", reference: "TRF1", notes: null });
    const [after] = await db.select().from(S.agentCommissions).where(eq(S.agentCommissions.id, c.id));
    expect(after.status).toBe("paid");
    const exp = await db.select().from(S.expenses).where(eq(S.expenses.payoutId, p.id));
    expect(exp).toHaveLength(1);
    expect(exp[0]).toMatchObject({ amount: 250_000, category: "agent_commissions" });
    // A paid commission locks the sale's profit figures and blocks deletion.
    await expect(updateSale(s.id, saleInput({ saleDate: "2026-09-10", sellingPrice: 30_000_000 }))).rejects.toBeInstanceOf(SaleError);
    await expect(deleteSale(s.id)).rejects.toBeInstanceOf(SaleError);
  });

  it("editing a sale recalculates and re-opens an approved commission", async () => {
    const s = await createSale(saleInput({ saleDate: "2026-08-01" }), { initialPayment: 23_000_000, deductStock: false });
    const [c] = await db.select().from(S.agentCommissions).where(eq(S.agentCommissions.saleId, s.id));
    await approveCommission(c.id, adminId);
    await updateSale(s.id, saleInput({ saleDate: "2026-08-01", saleExpenses: 500_000 }));
    const [after] = await db.select().from(S.agentCommissions).where(eq(S.agentCommissions.id, c.id));
    expect(after.amount).toBe(200_000);
    expect(after.status).toBe("pending");
  });

  it("deleting a sale restores the stock it deducted", async () => {
    const before = (await db.select().from(S.vehicles).where(eq(S.vehicles.id, vehicleId)))[0];
    const s = await createSale(saleInput({ agentId: null, colorId: silverId }), { initialPayment: 0, deductStock: true });
    const mid = (await db.select().from(S.vehicles).where(eq(S.vehicles.id, vehicleId)))[0];
    expect(mid.stockQuantity).toBe(before.stockQuantity - 1);
    await deleteSale(s.id);
    const after = (await db.select().from(S.vehicles).where(eq(S.vehicles.id, vehicleId)))[0];
    expect(after.stockQuantity).toBe(before.stockQuantity);
    expect(after.soldQuantity).toBe(before.soldQuantity);
  });

  it("agents only see masked names and their own referrals", async () => {
    const history = await agentReferralHistory(agentId);
    expect(history.length).toBeGreaterThan(0);
    for (const h of history) expect(h.customerPhone).toBeNull();
    expect(history.some((h) => h.customerName === "Kemi B.")).toBe(true);
    const stats = await agentStats(agentId);
    expect(stats.paid).toBe(250_000);
  });
});

describe("finance totals", () => {
  it("counts acquisition cost once, deducts operating expenses, tracks balances", async () => {
    await db.insert(S.expenses).values({ title: "Rent", category: "office", amount: 1_000_000, spentOn: "2026-07-05" });
    await createSale(saleInput({ agentId: null, saleDate: "2026-07-10", saleExpenses: 100_000 }), { initialPayment: 5_000_000, deductStock: false });
    await db.insert(S.vehicleAcquisitions).values({ brand: "Toyota", model: "Camry", year: 2023, purchaseDate: "2026-07-01", purchasePrice: 20_000_000, transportCost: 500_000, totalCost: 20_500_000 });
    const s = await periodSummary("2026-07-01", "2026-08-01");
    expect(s.revenue).toBe(23_000_000);
    expect(s.acquisitionCostOfSales).toBe(20_500_000);
    expect(s.grossProfit).toBe(2_500_000);
    expect(s.operatingExpenses).toBe(1_000_000);
    expect(s.netProfit).toBe(2_500_000 - 100_000 - 1_000_000);
    expect(s.vehiclesPurchasedCost).toBe(20_500_000); // shown, not deducted again
    expect(s.cashReceived).toBe(5_000_000);
    expect((await outstandingBalances()).customerOutstanding).toBeGreaterThanOrEqual(18_000_000);
  });
});

describe("demo data", () => {
  it("removes only rows flagged as demo", async () => {
    const demo = await makeVehicle({ isDemo: true });
    await removeDemoData();
    expect(await db.select().from(S.vehicles).where(eq(S.vehicles.id, demo.id))).toHaveLength(0);
    expect(await db.select().from(S.vehicles).where(eq(S.vehicles.id, vehicleId))).toHaveLength(1);
  });
});
