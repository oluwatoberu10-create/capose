import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { vehicleColors, vehicleFeatures, vehicleImages, vehicles } from "@/db/schema";
import { deriveAvailability, type Availability } from "@/lib/finance";
import { PAGE_SIZE } from "@/lib/constants";

/* ── public read model ─────────────────────────────────────────────────
 * Every public query selects from `publicColumns` only. Purchase cost and
 * additional expenses are never part of it, so they cannot leak into a page,
 * an API response or the RSC payload.
 */

export const effectivePriceSql = sql<number>`(case when ${vehicles.discountPrice} > 0 and ${vehicles.discountPrice} < ${vehicles.price} then ${vehicles.discountPrice} else ${vehicles.price} end)`;
const coverSql = sql<string | null>`(select vi.url from vehicle_images vi where vi.vehicle_id = "vehicles"."id" order by vi.is_featured desc, vi.position asc limit 1)`;

const publicColumns = {
  id: vehicles.id, slug: vehicles.slug, title: vehicles.title, brand: vehicles.brand, model: vehicles.model,
  year: vehicles.year, description: vehicles.description, stockNumber: vehicles.stockNumber, category: vehicles.category,
  condition: vehicles.condition, availability: vehicles.availability, featured: vehicles.featured,
  price: vehicles.price, originalPrice: vehicles.originalPrice, discountPrice: vehicles.discountPrice,
  engineType: vehicles.engineType, engineCapacity: vehicles.engineCapacity, horsepower: vehicles.horsepower,
  transmission: vehicles.transmission, driveType: vehicles.driveType, fuelType: vehicles.fuelType, mileage: vehicles.mileage,
  exteriorColor: vehicles.exteriorColor, interiorColor: vehicles.interiorColor, doors: vehicles.doors, seats: vehicles.seats,
  bodyType: vehicles.bodyType, steering: vehicles.steering, dimensions: vehicles.dimensions, vin: vehicles.vin,
  customSpecs: vehicles.customSpecs, stockQuantity: vehicles.stockQuantity, createdAt: vehicles.createdAt,
};

const cardColumns = {
  id: vehicles.id, slug: vehicles.slug, title: vehicles.title, brand: vehicles.brand, model: vehicles.model, year: vehicles.year,
  condition: vehicles.condition, availability: vehicles.availability, featured: vehicles.featured,
  price: vehicles.price, discountPrice: vehicles.discountPrice, transmission: vehicles.transmission,
  fuelType: vehicles.fuelType, mileage: vehicles.mileage, bodyType: vehicles.bodyType, cover: coverSql,
};

export type VehicleCard = {
  id: string; slug: string; title: string; brand: string; model: string; year: number;
  condition: "brand_new" | "foreign_used" | "nigerian_used"; availability: Availability; featured: boolean;
  price: number; discountPrice: number | null; transmission: string | null; fuelType: string | null;
  mileage: number | null; bodyType: string | null; cover: string | null;
};

export type InventoryFilters = {
  q?: string; brand?: string; model?: string; yearMin?: number; yearMax?: number; priceMin?: number; priceMax?: number;
  condition?: string; transmission?: string; fuel?: string; body?: string; availability?: string;
  sort?: "newest" | "price_asc" | "price_desc"; page?: number;
};

function num(v: string | string[] | undefined): number | undefined {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
function str(v: string | string[] | undefined): string | undefined {
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s.slice(0, 80) : undefined;
}

export function parseInventoryFilters(sp: Record<string, string | string[] | undefined>): InventoryFilters {
  const sort = str(sp.sort);
  return {
    q: str(sp.q), brand: str(sp.brand), model: str(sp.model), yearMin: num(sp.yearMin), yearMax: num(sp.yearMax),
    priceMin: num(sp.priceMin), priceMax: num(sp.priceMax), condition: str(sp.condition), transmission: str(sp.transmission),
    fuel: str(sp.fuel), body: str(sp.body), availability: str(sp.availability),
    sort: sort === "price_asc" || sort === "price_desc" ? sort : "newest", page: num(sp.page) ?? 1,
  };
}

const CONDITIONS = ["brand_new", "foreign_used", "nigerian_used"] as const;
const AVAILABILITIES = ["available", "reserved", "sold", "out_of_stock"] as const;

function filterWhere(f: InventoryFilters): SQL | undefined {
  const w: (SQL | undefined)[] = [eq(vehicles.published, true)];
  if (f.q) {
    const terms = f.q.split(/\s+/).filter(Boolean).slice(0, 5);
    for (const t of terms) {
      const like = `%${t.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      w.push(or(ilike(vehicles.title, like), ilike(vehicles.brand, like), ilike(vehicles.model, like), ilike(vehicles.bodyType, like), sql`${vehicles.year}::text = ${t}`));
    }
  }
  if (f.brand) w.push(ilike(vehicles.brand, f.brand));
  if (f.model) w.push(ilike(vehicles.model, f.model));
  if (f.yearMin) w.push(gte(vehicles.year, f.yearMin));
  if (f.yearMax) w.push(lte(vehicles.year, f.yearMax));
  if (f.priceMin) w.push(gte(effectivePriceSql, f.priceMin));
  if (f.priceMax) w.push(lte(effectivePriceSql, f.priceMax));
  if (f.condition && (CONDITIONS as readonly string[]).includes(f.condition)) w.push(eq(vehicles.condition, f.condition as (typeof CONDITIONS)[number]));
  if (f.availability && (AVAILABILITIES as readonly string[]).includes(f.availability)) w.push(eq(vehicles.availability, f.availability as Availability));
  if (f.transmission) w.push(ilike(vehicles.transmission, f.transmission));
  if (f.fuel) w.push(ilike(vehicles.fuelType, f.fuel));
  if (f.body) w.push(ilike(vehicles.bodyType, f.body));
  return and(...w);
}

export async function listPublicVehicles(f: InventoryFilters) {
  const where = filterWhere(f);
  const order = f.sort === "price_asc" ? [asc(effectivePriceSql), desc(vehicles.createdAt)]
    : f.sort === "price_desc" ? [desc(effectivePriceSql), desc(vehicles.createdAt)]
    // Newest first, but sold/out-of-stock cars sink below what can be bought today.
    : [sql`(${vehicles.availability} in ('sold','out_of_stock'))`, desc(vehicles.createdAt)];
  const page = Math.max(1, f.page ?? 1);
  const [items, [{ count }]] = await Promise.all([
    db.select(cardColumns).from(vehicles).where(where).orderBy(...order).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    db.select({ count: sql<number>`count(*)::int` }).from(vehicles).where(where),
  ]);
  return { items: items as VehicleCard[], total: count, page, pages: Math.max(1, Math.ceil(count / PAGE_SIZE)) };
}

/** Distinct values for the filter dropdowns, taken from what is actually listed. */
export async function inventoryFacets() {
  const rows = await db.selectDistinct({
    brand: vehicles.brand, model: vehicles.model, year: vehicles.year, transmission: vehicles.transmission,
    fuel: vehicles.fuelType, body: vehicles.bodyType,
  }).from(vehicles).where(eq(vehicles.published, true));
  const uniq = (xs: (string | number | null)[]) => [...new Set(xs.filter((x): x is string | number => x !== null && x !== ""))];
  return {
    brands: (uniq(rows.map((r) => r.brand)) as string[]).sort(),
    models: rows.map((r) => ({ brand: r.brand, model: r.model })).filter((v, i, a) => a.findIndex((x) => x.model === v.model && x.brand === v.brand) === i).sort((a, b) => a.model.localeCompare(b.model)),
    years: (uniq(rows.map((r) => r.year)) as number[]).sort((a, b) => b - a),
    transmissions: (uniq(rows.map((r) => r.transmission)) as string[]).sort(),
    fuels: (uniq(rows.map((r) => r.fuel)) as string[]).sort(),
    bodies: (uniq(rows.map((r) => r.body)) as string[]).sort(),
  };
}

export async function featuredVehicles(limit = 6): Promise<VehicleCard[]> {
  return (await db.select(cardColumns).from(vehicles)
    .where(and(eq(vehicles.published, true), eq(vehicles.featured, true)))
    .orderBy(sql`(${vehicles.availability} in ('sold','out_of_stock'))`, desc(vehicles.updatedAt)).limit(limit)) as VehicleCard[];
}

export async function latestAvailable(limit = 8, excludeIds: string[] = []): Promise<VehicleCard[]> {
  return (await db.select(cardColumns).from(vehicles)
    .where(and(eq(vehicles.published, true), eq(vehicles.availability, "available"), excludeIds.length ? notInArray(vehicles.id, excludeIds) : undefined))
    .orderBy(desc(vehicles.createdAt)).limit(limit)) as VehicleCard[];
}

export async function cardsByIds(ids: string[]): Promise<VehicleCard[]> {
  if (!ids.length) return [];
  return (await db.select(cardColumns).from(vehicles).where(and(eq(vehicles.published, true), inArray(vehicles.id, ids.slice(0, 100))))) as VehicleCard[];
}

export async function getPublicVehicle(slug: string) {
  const [v] = await db.select(publicColumns).from(vehicles).where(and(eq(vehicles.slug, slug), eq(vehicles.published, true))).limit(1);
  if (!v) return null;
  const [colors, images, features] = await Promise.all([
    db.select({ id: vehicleColors.id, name: vehicleColors.name, hex: vehicleColors.hex, stockQuantity: vehicleColors.stockQuantity })
      .from(vehicleColors).where(eq(vehicleColors.vehicleId, v.id)).orderBy(asc(vehicleColors.position), asc(vehicleColors.name)),
    db.select({ id: vehicleImages.id, url: vehicleImages.url, kind: vehicleImages.kind, colorId: vehicleImages.colorId, isFeatured: vehicleImages.isFeatured })
      .from(vehicleImages).where(eq(vehicleImages.vehicleId, v.id)).orderBy(desc(vehicleImages.isFeatured), asc(vehicleImages.position)),
    db.select({ name: vehicleFeatures.name }).from(vehicleFeatures).where(eq(vehicleFeatures.vehicleId, v.id)).orderBy(asc(vehicleFeatures.name)),
  ]);
  return { ...v, availability: v.availability as Availability, colors, images, features: features.map((f) => f.name) };
}
export type PublicVehicle = NonNullable<Awaited<ReturnType<typeof getPublicVehicle>>>;

export async function relatedVehicles(v: { id: string; brand: string; bodyType: string | null; price: number }, limit = 4): Promise<VehicleCard[]> {
  return (await db.select(cardColumns).from(vehicles)
    .where(and(eq(vehicles.published, true), ne(vehicles.id, v.id)))
    .orderBy(
      sql`(${vehicles.availability} in ('sold','out_of_stock'))`,
      sql`(case when ${vehicles.brand} = ${v.brand} then 0 when ${vehicles.bodyType} = ${v.bodyType ?? ""} then 1 else 2 end)`,
      sql`abs(${vehicles.price} - ${v.price})`,
    ).limit(limit)) as VehicleCard[];
}

/* ── stock & availability ─────────────────────────────────────────────── */

/**
 * Brings a vehicle's stock and status back in line after any change:
 *  1. if any colour tracks its own stock, the vehicle's stock is their sum;
 *  2. unless the admin overrode it, availability follows stock.
 */
export async function syncVehicleStock(tx: DbOrTx, vehicleId: string): Promise<void> {
  const [v] = await tx.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!v) return;
  const colors = await tx.select({ stock: vehicleColors.stockQuantity }).from(vehicleColors).where(eq(vehicleColors.vehicleId, vehicleId));
  const tracked = colors.filter((c) => c.stock !== null);
  const stock = tracked.length ? tracked.reduce((s, c) => s + (c.stock ?? 0), 0) : v.stockQuantity;
  const status = v.availabilityOverride ? v.availability : deriveAvailability(stock, v.reservedQuantity);
  if (stock !== v.stockQuantity || status !== v.availability) {
    await tx.update(vehicles).set({ stockQuantity: stock, availability: status }).where(eq(vehicles.id, vehicleId));
  }
}

/** Takes one unit out of stock (sale recorded). Returns false when nothing was in stock. */
export async function deductUnit(tx: DbOrTx, vehicleId: string, colorId: string | null): Promise<boolean> {
  const [v] = await tx.select({ stock: vehicles.stockQuantity }).from(vehicles).where(eq(vehicles.id, vehicleId)).for("update");
  if (!v) return false;
  if (colorId) {
    await tx.update(vehicleColors).set({ stockQuantity: sql`greatest(0, ${vehicleColors.stockQuantity} - 1)` })
      .where(and(eq(vehicleColors.id, colorId), sql`${vehicleColors.stockQuantity} is not null`));
  }
  await tx.update(vehicles).set({
    stockQuantity: sql`greatest(0, ${vehicles.stockQuantity} - 1)`,
    soldQuantity: sql`${vehicles.soldQuantity} + 1`,
  }).where(eq(vehicles.id, vehicleId));
  await syncVehicleStock(tx, vehicleId);
  return v.stock > 0;
}

/** Puts a unit back (a sale that had deducted stock was deleted). */
export async function restoreUnit(tx: DbOrTx, vehicleId: string, colorId: string | null): Promise<void> {
  if (colorId) {
    await tx.update(vehicleColors).set({ stockQuantity: sql`${vehicleColors.stockQuantity} + 1` })
      .where(and(eq(vehicleColors.id, colorId), sql`${vehicleColors.stockQuantity} is not null`));
  }
  await tx.update(vehicles).set({
    stockQuantity: sql`${vehicles.stockQuantity} + 1`,
    soldQuantity: sql`greatest(0, ${vehicles.soldQuantity} - 1)`,
  }).where(eq(vehicles.id, vehicleId));
  await syncVehicleStock(tx, vehicleId);
}

/* ── admin read model ─────────────────────────────────────────────────── */

export async function listAdminVehicles(opts: { q?: string; availability?: string; page: number; pageSize: number }) {
  const w: (SQL | undefined)[] = [];
  if (opts.q) {
    const like = `%${opts.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    w.push(or(ilike(vehicles.title, like), ilike(vehicles.brand, like), ilike(vehicles.model, like), ilike(vehicles.stockNumber, like), ilike(vehicles.vin, like)));
  }
  if (opts.availability && (AVAILABILITIES as readonly string[]).includes(opts.availability)) w.push(eq(vehicles.availability, opts.availability as Availability));
  const where = and(...w);
  const [rows, [{ count }]] = await Promise.all([
    db.select({
      id: vehicles.id, slug: vehicles.slug, title: vehicles.title, brand: vehicles.brand, model: vehicles.model, year: vehicles.year,
      stockNumber: vehicles.stockNumber, price: vehicles.price, discountPrice: vehicles.discountPrice,
      purchaseCost: vehicles.purchaseCost, additionalExpenses: vehicles.additionalExpenses,
      availability: vehicles.availability, availabilityOverride: vehicles.availabilityOverride, featured: vehicles.featured,
      published: vehicles.published, stockQuantity: vehicles.stockQuantity, reservedQuantity: vehicles.reservedQuantity,
      soldQuantity: vehicles.soldQuantity, isDemo: vehicles.isDemo, cover: coverSql, updatedAt: vehicles.updatedAt,
    }).from(vehicles).where(where).orderBy(desc(vehicles.createdAt)).limit(opts.pageSize).offset((opts.page - 1) * opts.pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(vehicles).where(where),
  ]);
  return { rows, total: count };
}

export async function getAdminVehicle(id: string) {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!v) return null;
  const [colors, images, features] = await Promise.all([
    db.select().from(vehicleColors).where(eq(vehicleColors.vehicleId, id)).orderBy(asc(vehicleColors.position)),
    db.select().from(vehicleImages).where(eq(vehicleImages.vehicleId, id)).orderBy(asc(vehicleImages.position)),
    db.select().from(vehicleFeatures).where(eq(vehicleFeatures.vehicleId, id)).orderBy(asc(vehicleFeatures.name)),
  ]);
  return { ...v, colors, images, features: features.map((f) => f.name) };
}
export type AdminVehicle = NonNullable<Awaited<ReturnType<typeof getAdminVehicle>>>;

/** Compact list for selects (sales, acquisitions, expenses). */
export async function vehicleOptions() {
  return db.select({ id: vehicles.id, title: vehicles.title, stockNumber: vehicles.stockNumber, price: vehicles.price, discountPrice: vehicles.discountPrice, purchaseCost: vehicles.purchaseCost, additionalExpenses: vehicles.additionalExpenses, brand: vehicles.brand, model: vehicles.model, year: vehicles.year })
    .from(vehicles).orderBy(asc(vehicles.brand), asc(vehicles.model), desc(vehicles.year));
}
