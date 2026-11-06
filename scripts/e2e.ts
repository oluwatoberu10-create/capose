/**
 * HTTP-level access-control and smoke checks against a running server.
 *
 *   npm run build && npm start        (in another terminal, with demo data loaded)
 *   npm run test:e2e                  (E2E_BASE defaults to http://localhost:3000)
 *
 * Sessions for an owner, a sales-staff admin and an agent are created directly
 * in the database (temporary rows, removed at the end) so no passwords are needed.
 */
import { loadDotEnv } from "./env";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
let failures = 0;
const ok = (cond: boolean, label: string, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${label}${!cond && extra ? ` — ${extra}` : ""}`);
  if (!cond) failures++;
};

async function get(path: string, cookie?: string) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: cookie ? { cookie } : {} });
  return { status: res.status, location: res.headers.get("location") ?? "", body: res.status < 300 ? await res.text() : "", type: res.headers.get("content-type") ?? "" };
}

async function main() {
  loadDotEnv();
  const { ensureEnv } = await import("./pg");
  ensureEnv();
  const { db, getPool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { generateToken, hashToken } = await import("../src/lib/crypto");

  // Temporary principals.
  const made: string[] = [];
  const session = async (role: "owner" | "sales" | "agent") => {
    const [u] = await db.insert(S.users).values({ email: `e2e-${role}-${Date.now()}@e2e.test`, name: `E2E ${role}`, role: role === "agent" ? "agent" : "admin", passwordHash: "x" }).returning();
    made.push(u.id);
    if (role === "agent") await db.insert(S.agents).values({ userId: u.id, referralCode: `E2E${Math.random().toString(36).slice(2, 7).toUpperCase()}`, status: "approved" });
    else await db.insert(S.admins).values({ userId: u.id, role });
    const token = generateToken();
    await db.insert(S.sessions).values({ userId: u.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) });
    return `am_session=${token}`;
  };

  try {
    const [owner, sales, agent] = [await session("owner"), await session("sales"), await session("agent")];
    const [v] = await db.select().from(S.vehicles).where(eq(S.vehicles.published, true)).limit(1);
    if (!v) throw new Error("No published vehicles — load demo data first (npm run demo:seed).");

    // Public pages
    for (const p of ["/", "/cars", `/cars/${v.slug}`, `/cars/${v.slug}/order`, "/agents", "/agents/register", "/agents/login", "/contact", "/privacy", "/terms", "/saved"]) {
      const r = await get(p);
      ok(r.status === 200, `public ${p} → 200`, String(r.status));
    }
    const detail = await get(`/cars/${v.slug}`);
    ok(!/purchaseCost|additionalExpenses|acquisitionCost/.test(detail.body), "car page HTML/RSC payload has no internal cost fields");
    ok(!detail.body.includes(String(v.purchaseCost)) || v.purchaseCost === 0, "car page does not contain the purchase cost figure");
    const list = await get("/cars");
    ok(!/purchaseCost|additionalExpenses/.test(list.body), "inventory payload has no internal cost fields");
    ok((await get("/cars/does-not-exist")).status === 404, "unknown car → 404");

    // Anonymous access to private areas
    for (const p of ["/admin", "/admin/crm", "/admin/vehicles", "/admin/crm/sales"]) {
      const r = await get(p);
      ok(r.status === 307 && r.location.includes("/admin/login"), `anonymous ${p} → admin login`, `${r.status} ${r.location}`);
    }
    ok((await get("/agents/dashboard")).location.includes("/agents/login"), "anonymous agent dashboard → agent login");
    ok((await get("/api/admin/reports/monthly-profit")).status === 401, "anonymous CSV export → 401");
    ok((await get("/api/admin/receipts/00000000-0000-0000-0000-000000000000")).status === 401, "anonymous receipt → 401");
    const up = await fetch(`${BASE}/api/admin/vehicles/${v.id}/images`, { method: "POST", body: new FormData() });
    ok(up.status === 401, "anonymous photo upload → 401", String(up.status));
    ok((await get("/media/..%2f..%2fpackage.json")).status === 404, "media path traversal → 404");
    ok((await get("/media/vehicles/x/../../../.env")).status === 404, "media traversal (dots) → 404");

    // Agent
    ok((await get("/agents/dashboard", agent)).status === 200, "agent dashboard → 200 for agent");
    ok((await get("/admin", agent)).location.includes("/admin/login"), "agent cannot open admin");
    ok((await get("/api/admin/reports/sales-history", agent)).status === 401, "agent cannot export financial CSV");

    // Sales staff (admin without finance)
    ok((await get("/admin/vehicles", sales)).status === 200, "sales staff can open vehicles");
    ok((await get("/admin/orders", sales)).status === 200, "sales staff can open orders");
    for (const p of ["/admin/crm", "/admin/crm/sales", "/admin/crm/expenses", "/admin/commissions", "/admin/settings"]) {
      const r = await get(p, sales);
      ok(r.status === 307 && r.location.includes("denied"), `sales staff blocked from ${p}`, `${r.status} ${r.location}`);
    }
    const salesVeh = await get(`/admin/vehicles/${v.id}`, sales);
    ok(salesVeh.status === 200 && !salesVeh.body.includes(`"purchaseCost":${v.purchaseCost}`) , "sales staff vehicle page omits purchase cost", "cost leaked");
    ok((await get("/api/admin/reports/monthly-profit", sales)).status === 401, "sales staff cannot export financial CSV");

    // Owner
    for (const p of ["/admin", "/admin/crm", "/admin/crm/sales", "/admin/crm/sales/new", "/admin/crm/acquisitions", "/admin/crm/acquisitions/new", "/admin/crm/expenses", "/admin/crm/reports",
      "/admin/vehicles", "/admin/vehicles/new", `/admin/vehicles/${v.id}`, "/admin/orders", "/admin/customers", "/admin/enquiries", "/admin/agents", "/admin/referrals", "/admin/commissions", "/admin/payouts", "/admin/settings"]) {
      const r = await get(p, owner);
      ok(r.status === 200, `owner ${p} → 200`, `${r.status} ${r.location}`);
    }
    const [o] = await db.select().from(S.orders).limit(1);
    if (o) ok((await get(`/admin/orders/${o.id}`, owner)).status === 200, "owner order detail → 200");
    const [s] = await db.select().from(S.sales).limit(1);
    if (s) ok((await get(`/admin/crm/sales/${s.id}`, owner)).status === 200, "owner sale detail → 200");
    for (const t of ["monthly-sales", "monthly-expenses", "monthly-profit", "sales-history", "outstanding", "commissions", "acquisitions"]) {
      const r = await get(`/api/admin/reports/${t}?year=2026&month=all`, owner);
      ok(r.status === 200 && r.type.includes("text/csv") && r.body.split("\n").length > 1, `CSV ${t} downloads`, `${r.status} ${r.type}`);
    }
    if (o) {
      const r = await get(`/order/${o.accessToken}`);
      ok(r.status === 200 && r.body.includes(o.reference), "customer confirmation link works");
      ok((await get(`/order/${"x".repeat(32)}`)).status === 404, "guessed confirmation link → 404");
    }
  } finally {
    if (made.length) await db.delete(S.users).where(inArray(S.users.id, made));
    await getPool().end();
  }
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
