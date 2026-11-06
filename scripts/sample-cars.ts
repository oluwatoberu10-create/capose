/**
 * Adds a few sample cars (from the demo set) without any demo accounts, sales or
 * finance records — safe for a live site. Cars are flagged is_demo, so
 * Admin → Settings → Remove demo data deletes them again.
 *
 *   npm run demo:cars                    (Camry + Range Rover Sport)
 *   npm run demo:cars -- amggt huracan   (any keys from scripts/demo-data.ts)
 *   npm run demo:cars -- camry rangerover --refresh   (update photos/colours of demo cars already added)
 */
import { loadDotEnv } from "./env";
import { VEHICLES } from "./demo-data";

async function main() {
  loadDotEnv();
  const { ensureEnv } = await import("./pg");
  ensureEnv();
  const { db, getPool } = await import("../src/db");
  const S = await import("../src/db/schema");
  const { and, eq, like, sql } = await import("drizzle-orm");
  const { slugify } = await import("../src/lib/format");
  const { syncVehicleStock } = await import("../src/server/services/vehicles");

  const refresh = process.argv.includes("--refresh");
  const keys = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const wanted = keys.length ? keys : ["camry", "rangerover"];
  for (const key of wanted) {
    const v = VEHICLES.find((x) => x.key === key);
    if (!v) { console.log(`[cars] unknown key "${key}" — choose from: ${VEHICLES.map((x) => x.key).join(", ")}`); continue; }
    const slug = slugify(`${v.brand} ${v.model} ${v.year} ${v.exterior}`);
    const [exists] = await db.select({ id: S.vehicles.id, isDemo: S.vehicles.isDemo }).from(S.vehicles).where(eq(S.vehicles.slug, slug)).limit(1);
    if (exists && !(refresh && exists.isDemo)) { console.log(`[cars] ${slug} already exists — skipped${refresh ? " (not a demo car)" : ""}`); continue; }
    if (exists) {
      // --refresh: bring an existing demo car's colours and demo photos up to date.
      // Only /demo/ photos are replaced; photos uploaded in the admin are left alone.
      await db.transaction(async (tx) => {
        const current = await tx.select().from(S.vehicleColors).where(eq(S.vehicleColors.vehicleId, exists.id));
        const colorIds: Record<string, string> = Object.fromEntries(current.map((c) => [c.name, c.id]));
        for (const [i, c] of (v.colors ?? []).entries()) {
          if (colorIds[c.name]) continue;
          const [cr] = await tx.insert(S.vehicleColors).values({ vehicleId: exists.id, name: c.name, hex: c.hex, stockQuantity: c.stock, position: current.length + i }).returning();
          colorIds[c.name] = cr.id;
        }
        await tx.delete(S.vehicleImages).where(and(eq(S.vehicleImages.vehicleId, exists.id), like(S.vehicleImages.url, "/demo/%")));
        const kept = await tx.select({ id: S.vehicleImages.id }).from(S.vehicleImages).where(eq(S.vehicleImages.vehicleId, exists.id));
        for (const [i, img] of v.images.entries()) {
          await tx.insert(S.vehicleImages).values({ vehicleId: exists.id, url: `/demo/${img.file}.jpg`, kind: img.kind as "front", position: kept.length + i, isFeatured: !kept.length && i === 0, colorId: img.color ? colorIds[img.color] ?? null : null });
        }
        await tx.update(S.vehicles).set({ description: v.description, updatedAt: new Date() }).where(eq(S.vehicles.id, exists.id));
        await syncVehicleStock(tx, exists.id);
      });
      console.log(`[cars] refreshed ${slug}: ${v.images.length} photos, ${(v.colors ?? []).length} colours`);
      continue;
    }
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(S.vehicles);
    let stockNumber = `AM-${1001 + n}`;
    for (let i = 0; (await db.select({ id: S.vehicles.id }).from(S.vehicles).where(eq(S.vehicles.stockNumber, stockNumber)).limit(1)).length; i++) stockNumber = `AM-${1002 + n + i}`;

    await db.transaction(async (tx) => {
      const [row] = await tx.insert(S.vehicles).values({
        slug, title: `${v.year} ${v.brand} ${v.model}`, brand: v.brand, model: v.model, year: v.year, description: v.description,
        stockNumber, category: v.category, condition: v.condition, featured: !!v.featured,
        price: v.price, discountPrice: v.discountPrice ?? null, purchaseCost: v.cost, additionalExpenses: v.extra,
        engineType: v.engineType, engineCapacity: v.engineCapacity, horsepower: v.hp, transmission: v.transmission, driveType: v.drive,
        fuelType: v.fuel, mileage: v.mileage, exteriorColor: v.exterior, interiorColor: v.interior, doors: v.doors, seats: v.seats,
        bodyType: v.body, steering: "Left-hand drive", customSpecs: v.specs ?? [],
        stockQuantity: Math.max(1, v.stock), reservedQuantity: 0, soldQuantity: 0, isDemo: true,
      }).returning();
      const colorIds: Record<string, string> = {};
      for (const [i, c] of (v.colors ?? []).entries()) {
        const [cr] = await tx.insert(S.vehicleColors).values({ vehicleId: row.id, name: c.name, hex: c.hex, stockQuantity: c.stock, position: i }).returning();
        colorIds[c.name] = cr.id;
      }
      for (const [i, img] of v.images.entries()) {
        await tx.insert(S.vehicleImages).values({ vehicleId: row.id, url: `/demo/${img.file}.jpg`, kind: img.kind as "front", position: i, isFeatured: i === 0, colorId: img.color ? colorIds[img.color] ?? null : null });
      }
      if (v.features.length) await tx.insert(S.vehicleFeatures).values(v.features.map((name) => ({ vehicleId: row.id, name })));
      await syncVehicleStock(tx, row.id);
      console.log(`[cars] added ${row.title} → /cars/${slug}`);
    });
  }
  await getPool().end();
}

main().catch((e) => { console.error("[demo:cars]", e); process.exit(1); });
