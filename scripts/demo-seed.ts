/**
 * Loads clearly-marked demo data: 16 vehicles (photos in /public/demo), colours,
 * features, acquisitions, ~11 months of sales and expenses, three agents,
 * orders, referrals, commissions and payouts. Every row has is_demo = true and
 * can be removed with `npm run demo:remove` or Admin → Settings.
 *
 *   npm run demo:seed            (does nothing if demo data already exists)
 *   npm run demo:seed -- --fresh (removes existing demo data first)
 *
 * Demo logins (flagged demo):
 *   admin@aurum-demo.test  / AurumDemo!2026   (only created when no admin exists)
 *   ada@aurum-demo.test    / AgentDemo!2026   (approved agent)
 */
import { loadDotEnv } from "./env";

import { M, VEHICLES } from "./demo-data";

type SaleSpec = { v: string | null; title?: string; date: string; price: number; discount?: number; extra?: number; cost: number; exp: number; customer: [string, string, string | null]; paid: "full" | number; agent?: string; method?: "bank_transfer" | "cash" | "pos"; order?: string };
const SALES: SaleSpec[] = [
  { v: "camry", date: "2026-01-14", price: Math.round(48.5 * M), cost: Math.round(43.1 * M), exp: 150_000, customer: ["Emeka Nwosu", "0803 214 5567", "emeka.nwosu@example.com"], paid: "full" },
  { v: "crv", date: "2026-01-28", price: Math.round(22.5 * M), discount: 500_000, cost: Math.round(18.9 * M), exp: 100_000, customer: ["Fatima Bello", "0809 551 2033", null], paid: "full", method: "cash" },
  { v: null, title: "2018 Lexus RX 350 — White", date: "2026-02-10", price: Math.round(31 * M), extra: 250_000, cost: Math.round(26.4 * M), exp: 120_000, customer: ["Olumide Adeyemi", "0812 777 1290", "olumide.a@example.com"], paid: "full", agent: "ada" },
  { v: "rav4", date: "2026-02-22", price: Math.round(72 * M), discount: Math.round(1 * M), cost: Math.round(63.5 * M), exp: 200_000, customer: ["Chinedu Okeke", "0703 118 4420", null], paid: "full" },
  { v: "explorer", date: "2026-03-05", price: Math.round(38 * M), cost: Math.round(32.2 * M), exp: 150_000, customer: ["Halima Yusuf", "0806 330 9184", "halima.y@example.com"], paid: "full", method: "pos" },
  { v: "mustang", date: "2026-03-26", price: Math.round(42 * M), cost: Math.round(35.8 * M), exp: 100_000, customer: ["Tobi Ogunleye", "0817 902 3341", null], paid: "full", agent: "tunde" },
  { v: "accent", date: "2026-04-09", price: Math.round(19 * M), cost: Math.round(16.1 * M), exp: 80_000, customer: ["Grace Etim", "0802 645 7710", null], paid: "full" },
  { v: null, title: "2020 Toyota Highlander — Black", date: "2026-04-30", price: Math.round(44 * M), cost: Math.round(38.5 * M), exp: 150_000, customer: ["Yakubu Danjuma", "0805 228 6619", null], paid: "full" },
  { v: "camry", date: "2026-05-16", price: Math.round(48.5 * M), discount: Math.round(1.5 * M), cost: Math.round(43.1 * M), exp: 150_000, customer: ["Adaeze Nnamdi", "0813 449 0021", "adaeze.n@example.com"], paid: "full" },
  { v: "rangerover", date: "2026-06-03", price: Math.round(165 * M), discount: Math.round(3 * M), cost: Math.round(146 * M), exp: 400_000, customer: ["Babatunde Lawal", "0802 100 8833", "b.lawal@example.com"], paid: "full", agent: "ada" },
  { v: "explorer", date: "2026-06-25", price: Math.round(38 * M), cost: Math.round(32.2 * M), exp: 150_000, customer: ["Funmi Akande", "0814 557 2290", null], paid: "full" },
  { v: "model3", date: "2026-07-11", price: Math.round(58 * M), cost: Math.round(50.5 * M), exp: 200_000, customer: ["Kunle Coker", "0809 776 1102", "kunle.c@example.com"], paid: "full" },
  { v: null, title: "2017 Mercedes-Benz GLE 43 — Grey", date: "2026-07-29", price: Math.round(52 * M), cost: Math.round(53.2 * M), exp: 100_000, customer: ["Musa Garba", "0703 665 4127", null], paid: "full", agent: "tunde" },
  { v: "bmw430", date: "2026-08-18", price: Math.round(32.5 * M), cost: Math.round(28.6 * M), exp: 100_000, customer: ["Ifeoma Chukwu", "0816 210 5538", null], paid: "full" },
  { v: "expedition", date: "2026-09-06", price: Math.round(78 * M), cost: Math.round(68.9 * M), exp: 250_000, customer: ["Samuel Ojo", "0806 440 7782", "samuel.ojo@example.com"], paid: "full", agent: "ada" },
  { v: "crv", date: "2026-09-27", price: Math.round(22.5 * M), cost: Math.round(19.2 * M), exp: 100_000, customer: ["Zainab Ahmed", "0811 302 9945", null], paid: "full" },
  { v: "m5", date: "2026-10-14", price: Math.round(118 * M), discount: Math.round(2 * M), cost: Math.round(104 * M), exp: 300_000, customer: ["Segun Afolabi", "0803 998 1270", "segun.afolabi@example.com"], paid: Math.round(80 * M), agent: "tunde", order: "m5order" },
  { v: "camry", date: "2026-10-30", price: Math.round(48.5 * M), cost: Math.round(43.1 * M), exp: 150_000, customer: ["Rita Okon", "0807 115 6603", null], paid: Math.round(20 * M) },
  { v: "accent", date: "2026-11-03", price: Math.round(19 * M), cost: Math.round(16.1 * M), exp: 80_000, customer: ["David Ekpo", "0815 774 0019", null], paid: 0 },
];

async function main() {
  loadDotEnv();
  const { ensureEnv } = await import("./pg");
  ensureEnv();
  // Demo accounts use passwords published in the README — never load them into a live database.
  const { assertLocal } = await import("./local-guard");
  assertLocal("demo:seed", "AURUM_ALLOW_REMOTE_SEED");
  const { db, getPool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const { sql, eq } = await import("drizzle-orm");
  const { hashPassword, generateToken } = await import("../src/lib/crypto");
  const { slugify, phoneKey } = await import("../src/lib/format");
  const { acquisitionTotal } = await import("../src/lib/finance");
  const { createSale, approveCommission, recordPayout } = await import("../src/server/services/sales");
  const { syncVehicleStock } = await import("../src/server/services/vehicles");
  const { removeDemoData } = await import("../src/server/services/demo");

  const [{ n: existing }] = await db.select({ n: sql<number>`count(*)::int` }).from(S.vehicles).where(eq(S.vehicles.isDemo, true));
  if (existing > 0) {
    if (!process.argv.includes("--fresh")) { console.log("[demo] demo data already present — run with --fresh to reload it."); await getPool().end(); return; }
    console.log("[demo] removing existing demo data…");
    await removeDemoData();
  }

  // An admin login for trying the platform — only when there is no admin at all.
  const [{ n: adminCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(S.admins);
  if (adminCount === 0) {
    const [u] = await db.insert(S.users).values({ email: "admin@aurum-demo.test", name: "Demo Owner", role: "admin", passwordHash: await hashPassword("AurumDemo!2026"), isDemo: true }).returning();
    await db.insert(S.admins).values({ userId: u.id, role: "owner" });
    console.log("[demo] admin login: admin@aurum-demo.test / AurumDemo!2026");
  }

  // Agents.
  const agentPw = await hashPassword("AgentDemo!2026");
  const agentIds: Record<string, string> = {};
  const agentCodes: Record<string, string> = {};
  for (const [key, name, email, phone, code, status, joined] of [
    ["ada", "Ada Okafor", "ada@aurum-demo.test", "0803 400 1122", "ADAK7M2Q", "approved", "2026-01-05"],
    ["tunde", "Tunde Bakare", "tunde@aurum-demo.test", "0805 600 3344", "TUN4XH8P", "approved", "2026-02-18"],
    ["chioma", "Chioma Eze", "chioma@aurum-demo.test", "0812 700 5566", "CHI9RW3D", "pending", "2026-11-01"],
  ] as const) {
    const [u] = await db.insert(S.users).values({ email, name, phone, role: "agent", passwordHash: agentPw, isDemo: true, createdAt: new Date(joined) }).returning();
    const [a] = await db.insert(S.agents).values({ userId: u.id, referralCode: code, status, approvedAt: status === "approved" ? new Date(joined) : null, isDemo: true, createdAt: new Date(joined) }).returning();
    agentIds[key] = a.id;
    agentCodes[key] = code;
  }

  // Vehicles with colours, photos, features and the acquisition of the units in stock.
  const vIds: Record<string, string> = {};
  const slugs: Record<string, string> = {};
  const colorIds: Record<string, Record<string, string>> = {};
  let n = 0;
  for (const v of VEHICLES) {
    n++;
    const created = new Date(Date.UTC(2026, 9, 1 + n, 9));
    const [row] = await db.insert(S.vehicles).values({
      slug: slugify(`${v.brand} ${v.model} ${v.year} ${v.exterior}`), title: `${v.year} ${v.brand} ${v.model}`, brand: v.brand, model: v.model, year: v.year,
      description: v.description, stockNumber: `AM-${String(1000 + n).padStart(4, "0")}`, category: v.category, condition: v.condition,
      availability: v.override ?? "available", availabilityOverride: !!v.override, featured: !!v.featured,
      price: v.price, discountPrice: v.discountPrice ?? null, purchaseCost: v.cost, additionalExpenses: v.extra,
      engineType: v.engineType, engineCapacity: v.engineCapacity, horsepower: v.hp, transmission: v.transmission, driveType: v.drive, fuelType: v.fuel,
      mileage: v.mileage, exteriorColor: v.exterior, interiorColor: v.interior, doors: v.doors, seats: v.seats, bodyType: v.body, steering: "Left-hand drive",
      customSpecs: v.specs ?? [], stockQuantity: v.stock, reservedQuantity: v.reserved ?? 0, soldQuantity: v.sold ?? 0, isDemo: true, createdAt: created, updatedAt: created,
    }).returning();
    vIds[v.key] = row.id;
    slugs[v.key] = row.slug;
    colorIds[v.key] = {};
    for (const [i, c] of (v.colors ?? []).entries()) {
      const [cr] = await db.insert(S.vehicleColors).values({ vehicleId: row.id, name: c.name, hex: c.hex, stockQuantity: c.stock, position: i }).returning();
      colorIds[v.key][c.name] = cr.id;
    }
    for (const [i, img] of v.images.entries()) {
      await db.insert(S.vehicleImages).values({ vehicleId: row.id, url: `/demo/${img.file}.jpg`, kind: img.kind as "front", position: i, isFeatured: i === 0, colorId: img.color ? colorIds[v.key][img.color] ?? null : null });
    }
    await db.insert(S.vehicleFeatures).values(v.features.map((name) => ({ vehicleId: row.id, name })));
    await syncVehicleStock(db, row.id);
    const units = v.stock + (v.reserved ?? 0);
    if (units > 0) {
      const t = Math.round(v.extra * 0.45), c = Math.round(v.extra * 0.4);
      const acq = { purchasePrice: v.cost * units, transportCost: t * units, customsCost: c * units, repairsCost: (v.extra - t - c) * units };
      await db.insert(S.vehicleAcquisitions).values({
        vehicleId: row.id, brand: v.brand, model: v.model, year: v.year, stockNumber: row.stockNumber,
        purchaseDate: `2026-${String(7 + (n % 4)).padStart(2, "0")}-${String(3 + n).padStart(2, "0")}`, units,
        seller: v.condition === "brand_new" ? "Authorised distributor, Lagos" : n % 2 ? "Copart auction, USA" : "Cotonou trade partner",
        ...acq, totalCost: acquisitionTotal(acq), isDemo: true,
      });
    }
  }

  // Orders, inserted directly so they can carry historical dates.
  const orderIds: Record<string, string> = {};
  const upsertDemoCustomer = async (cust: [string, string, string | null], date: string) => {
    const pk = phoneKey(cust[1]);
    const [found] = await db.select().from(S.customers).where(eq(S.customers.phoneKey, pk)).limit(1);
    if (found) return found;
    return (await db.insert(S.customers).values({ name: cust[0], phone: cust[1], phoneKey: pk, email: cust[2], isDemo: true, createdAt: new Date(date) }).returning())[0];
  };
  const addOrder = async (key: string, vkey: string, color: string | null, cust: [string, string, string | null], status: "pending" | "confirmed" | "processing" | "completed" | "cancelled", date: string, agent?: string, msg?: string) => {
    const spec = VEHICLES.find((x) => x.key === vkey)!;
    const price = spec.discountPrice ?? spec.price;
    const c = await upsertDemoCustomer(cust, date);
    const agentId = agent ? agentIds[agent] : null;
    const code = agent ? agentCodes[agent] : null;
    const at = new Date(`${date}T10:30:00Z`);
    const [o] = await db.insert(S.orders).values({
      reference: `AM-${date.slice(2).replace(/-/g, "")}-${key.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5).padEnd(5, "X")}`, accessToken: generateToken(24), customerId: c.id,
      status, paymentStatus: "pending", subtotal: price, total: price, message: msg ?? null, agentId, referralCode: code, isDemo: true, createdAt: at, updatedAt: at,
    }).returning();
    await db.insert(S.orderItems).values({ orderId: o.id, vehicleId: vIds[vkey], colorId: color ? colorIds[vkey][color] : null, vehicleTitle: `${spec.year} ${spec.brand} ${spec.model}`, colorName: color, quantity: 1, unitPrice: price, lineTotal: price });
    if (agentId) await db.insert(S.referrals).values({ agentId, referralCode: code!, customerId: c.id, orderId: o.id, vehicleId: vIds[vkey], isDemo: true, createdAt: at });
    orderIds[key] = o.id;
  };
  await addOrder("segun", "m5", null, ["Segun Afolabi", "0803 998 1270", "segun.afolabi@example.com"], "completed", "2026-10-09", "tunde", "Can I pay in two instalments?");
  await addOrder("bisi", "amggt", "Jupiter Red", ["Bisi Alade", "0802 333 7781", "bisi.alade@example.com"], "confirmed", "2026-10-28", undefined, "Would like an inspection on Saturday.");
  await addOrder("ibrah", "rav4", "Blue", ["Ibrahim Musa", "0806 123 4499", null], "processing", "2026-10-20", "tunde");
  await addOrder("ngozi", "rangerover", null, ["Ngozi Umeh", "0813 666 2210", "ngozi.u@example.com"], "cancelled", "2026-09-14");
  await addOrder("kelec", "camry", "Silver", ["Kelechi Obi", "0809 412 7765", null], "pending", "2026-11-04", "ada", "Is the price negotiable?");
  await addOrder("tolub", "panamera", null, ["Tolu Bankole", "0817 220 4410", "tolu.b@example.com"], "pending", "2026-11-05");

  // Acquisitions behind historical sales, then the sales — through the real service, so commissions follow the real rules.
  const saleIds: string[] = [];
  for (const s of SALES) {
    const spec = s.v ? VEHICLES.find((x) => x.key === s.v)! : null;
    const acqDate = new Date(new Date(`${s.date}T00:00:00Z`).getTime() - 24 * 864e5).toISOString().slice(0, 10);
    const name = spec ? `${spec.brand} ${spec.model}` : s.title!.replace(/^\d{4} /, "").split(" — ")[0];
    const [brand, ...rest] = name.split(" ");
    const extra = Math.round(s.cost * 0.06);
    const acq = { purchasePrice: s.cost - extra, transportCost: Math.round(extra * 0.5), customsCost: extra - Math.round(extra * 0.5) };
    await db.insert(S.vehicleAcquisitions).values({ vehicleId: null, brand, model: rest.join(" "), year: spec?.year ?? Number(s.title!.slice(0, 4)), purchaseDate: acqDate, units: 1, seller: "Copart auction, USA", ...acq, totalCost: acquisitionTotal(acq), notes: `Unit sold ${s.date}`, isDemo: true });
    const total = s.price - (s.discount ?? 0) + (s.extra ?? 0);
    const sale = await createSale({
      vehicleId: s.v ? vIds[s.v] : null, vehicleTitle: spec ? `${spec.year} ${spec.brand} ${spec.model}` : s.title!, colorId: null,
      customerName: s.customer[0], customerPhone: s.customer[1], customerEmail: s.customer[2], orderId: s.order ? orderIds[s.order] : null,
      agentId: s.agent ? agentIds[s.agent] : null, saleDate: s.date, sellingPrice: s.price, discount: s.discount ?? 0, additionalIncome: s.extra ?? 0,
      acquisitionCost: s.cost, saleExpenses: s.exp, paymentMethod: s.method ?? "bank_transfer", notes: null,
    }, { initialPayment: s.paid === "full" ? total : s.paid, deductStock: false, isDemo: true });
    saleIds.push(sale.id);
  }
  await db.execute(sql`update customers set is_demo = true where id in (select customer_id from sales where is_demo)`);
  await db.execute(sql`update referrals set is_demo = true where sale_id in (select id from sales where is_demo)`);

  // Commission workflow: approve and pay out the older referred sales; leave the Expedition approved and the M5 pending.
  const [owner] = await db.select({ id: S.users.id }).from(S.users).innerJoin(S.admins, eq(S.admins.userId, S.users.id)).limit(1);
  const commissionOf = async (i: number) => (await db.select().from(S.agentCommissions).where(eq(S.agentCommissions.saleId, saleIds[i])))[0];
  for (const [i, paidOn] of [[2, "2026-03-10"], [5, "2026-04-08"], [9, "2026-07-05"]] as const) {
    const c = await commissionOf(i);
    await approveCommission(c.id, owner.id);
    const p = await recordPayout({ agentId: c.agentId, commissionIds: [c.id], paidOn, method: "bank_transfer", reference: `TRF-${paidOn.replace(/-/g, "")}`, notes: null });
    await db.update(S.commissionPayouts).set({ isDemo: true }).where(eq(S.commissionPayouts.id, p.id));
    await db.update(S.expenses).set({ isDemo: true }).where(eq(S.expenses.payoutId, p.id));
  }
  await approveCommission((await commissionOf(14)).id, owner.id);

  // Operating expenses, January to November.
  const monthly: { title: string; category: "office" | "staff" | "marketing" | "maintenance"; amount: number; day: string }[] = [
    { title: "Showroom rent", category: "office", amount: 1_500_000, day: "01" },
    { title: "Staff salaries", category: "staff", amount: 2_400_000, day: "28" },
    { title: "Instagram & Google ads", category: "marketing", amount: 650_000, day: "12" },
    { title: "Generator diesel & servicing", category: "maintenance", amount: 185_000, day: "18" },
  ];
  for (let m = 1; m <= 11; m++) {
    for (const e of monthly) {
      if (m === 11 && Number(e.day) > 5) continue;
      const amount = e.category === "marketing" ? e.amount + ((m * 37_000) % 250_000) : e.amount;
      await db.insert(S.expenses).values({ title: e.title, category: e.category, amount, spentOn: `2026-${String(m).padStart(2, "0")}-${e.day}`, isDemo: true });
    }
  }
  await db.insert(S.expenses).values([
    { title: "Detailing before handover", category: "maintenance", amount: 95_000, spentOn: "2026-05-07", vehicleId: vIds.camry, isDemo: true },
    { title: "Billboard — Lekki-Epe Expressway", category: "marketing", amount: 2_800_000, spentOn: "2026-08-02", isDemo: true },
    { title: "Office furniture", category: "office", amount: 1_150_000, spentOn: "2026-02-15", isDemo: true },
  ]);

  // Enquiries, a notify request and referral link visits.
  await db.insert(S.enquiries).values([
    { kind: "vehicle_info", vehicleId: vIds.panamera, name: "Dapo Williams", phone: "0803 551 9020", message: "Is the Panamera still available? Can I see it this weekend?", isDemo: true },
    { kind: "contact", name: "Amaka Obi", email: "amaka.obi@example.com", message: "Do you source Lexus LX 600 to order? Budget around ₦250M.", isDemo: true },
  ]);
  await db.insert(S.customerNotifications).values({ vehicleId: vIds.explorer, name: "Peter Udo", phone: "0816 400 2218", isDemo: true });
  const visitCars = ["camry", "rav4", "amggt", "rangerover", null];
  for (let i = 0; i < 26; i++) {
    const vk = visitCars[i % 5];
    await db.insert(S.referralVisits).values({ agentId: agentIds[i % 3 === 0 ? "tunde" : "ada"], vehicleId: vk ? vIds[vk] : null, path: vk ? `/cars/${slugs[vk]}` : "/", createdAt: new Date(Date.now() - i * 2.7 * 864e5) });
  }

  console.log(`[demo] loaded ${VEHICLES.length} vehicles, ${SALES.length} sales, 3 agents, 6 orders. Agent login: ada@aurum-demo.test / AgentDemo!2026`);
  await getPool().end();
}

main().catch((e) => { console.error("[demo:seed]", e); process.exit(1); });
