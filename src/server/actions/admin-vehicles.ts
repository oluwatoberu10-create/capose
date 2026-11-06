"use server";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { orderItems, sales, vehicleColors, vehicleFeatures, vehicleImages, vehicles } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { slugify } from "@/lib/format";
import { can, requireAdmin } from "@/server/auth";
import { deleteImageUrl } from "@/server/storage";
import { syncVehicleStock } from "@/server/services/vehicles";
import { formObject, run, UserError, zBool, zId, zInt, zMoney, zOptInt, zOptMoney, zOptText, zText } from "./util";

const colorSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, "Colour name is required.").max(40),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour."),
  stockQuantity: z.number().int().min(0).max(10000).nullable(),
});
const specSchema = z.object({ label: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(200) });

const vehicleSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")).transform((s) => s || null),
  brand: zText("Brand", 60), model: zText("Model", 80),
  year: zInt("Year", 1950, new Date().getFullYear() + 2),
  title: z.string().optional().transform((s) => s?.trim().slice(0, 140) || ""),
  description: z.string().optional().transform((s) => s?.trim().slice(0, 8000) ?? ""),
  vin: zOptText(40), stockNumber: zText("Stock number", 40), category: z.string().optional().transform((s) => s?.trim().slice(0, 60) ?? ""),
  condition: z.enum(["brand_new", "foreign_used", "nigerian_used"], { message: "Choose a condition." }),
  featured: zBool, published: zBool,
  price: zMoney("Selling price", { required: true, min: 1 }), originalPrice: zOptMoney, discountPrice: zOptMoney,
  purchaseCost: zMoney("Purchase cost"), additionalExpenses: zMoney("Additional expenses"),
  engineType: zOptText(60), engineCapacity: zOptText(30), horsepower: zOptInt("Horsepower", 0, 3000),
  transmission: zOptText(40), driveType: zOptText(20), fuelType: zOptText(30), mileage: zOptInt("Mileage", 0, 3_000_000),
  exteriorColor: zOptText(40), interiorColor: zOptText(40), doors: zOptInt("Doors", 0, 10), seats: zOptInt("Seats", 0, 60),
  bodyType: zOptText(40), steering: zOptText(30), dimensions: zOptText(120),
  stockQuantity: zInt("Stock quantity", 0, 10000), reservedQuantity: zInt("Reserved quantity", 0, 10000), soldQuantity: zInt("Sold quantity", 0, 100000),
  availabilityOverride: zBool,
  availability: z.enum(["available", "reserved", "sold", "out_of_stock"]),
  colors: z.string().transform((s, ctx) => { try { return z.array(colorSchema).max(20).parse(JSON.parse(s || "[]")); } catch { ctx.addIssue({ code: "custom", message: "Check the colour rows — each needs a name." }); return []; } }),
  features: z.string().transform((s) => { try { return z.array(z.string().trim().min(1).max(60)).max(80).parse(JSON.parse(s || "[]")); } catch { return []; } }),
  customSpecs: z.string().transform((s, ctx) => { try { return z.array(specSchema).max(40).parse(JSON.parse(s || "[]")); } catch { ctx.addIssue({ code: "custom", message: "Each custom specification needs a label and a value." }); return []; } }),
}).refine((v) => !v.discountPrice || v.discountPrice < v.price, { message: "Discount price must be lower than the selling price.", path: ["discountPrice"] });

async function uniqueSlug(base: string, excludeId: string | null) {
  const root = slugify(base) || "vehicle";
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${root}-${i + 1}` : root;
    const [hit] = await db.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.slug, slug), excludeId ? ne(vehicles.id, excludeId) : undefined)).limit(1);
    if (!hit) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function saveVehicle(_: ActionState, fd: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  const r = await run(async () => {
    const admin = await requireAdmin("inventory");
    const v = vehicleSchema.parse(formObject(fd));
    const [dupe] = await db.select({ id: vehicles.id }).from(vehicles).where(and(eq(vehicles.stockNumber, v.stockNumber), v.id ? ne(vehicles.id, v.id) : undefined)).limit(1);
    if (dupe) return { ok: false, message: "That stock number is already used.", errors: { stockNumber: "Stock numbers must be unique." } };

    const title = v.title || `${v.year} ${v.brand} ${v.model}`;
    const firstColor = v.colors[0]?.name;
    const values = {
      title, brand: v.brand, model: v.model, year: v.year, description: v.description, vin: v.vin, stockNumber: v.stockNumber,
      category: v.category, condition: v.condition, featured: v.featured, published: v.published,
      price: v.price, originalPrice: v.originalPrice, discountPrice: v.discountPrice,
      engineType: v.engineType, engineCapacity: v.engineCapacity, horsepower: v.horsepower, transmission: v.transmission,
      driveType: v.driveType, fuelType: v.fuelType, mileage: v.mileage, exteriorColor: v.exteriorColor ?? firstColor ?? null,
      interiorColor: v.interiorColor, doors: v.doors, seats: v.seats, bodyType: v.bodyType, steering: v.steering, dimensions: v.dimensions,
      customSpecs: v.customSpecs, stockQuantity: v.stockQuantity, reservedQuantity: v.reservedQuantity, soldQuantity: v.soldQuantity,
      availabilityOverride: v.availabilityOverride, availability: v.availability,
      // Sales staff cannot see or change internal costs.
      ...(can(admin, "finance") ? { purchaseCost: v.purchaseCost, additionalExpenses: v.additionalExpenses } : {}),
    };

    await db.transaction(async (tx) => {
      let id = v.id;
      if (id) {
        const [exists] = await tx.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, id)).limit(1);
        if (!exists) throw new UserError("Vehicle not found.");
        await tx.update(vehicles).set(values).where(eq(vehicles.id, id));
      } else {
        const slug = await uniqueSlug(`${v.brand} ${v.model} ${v.year} ${firstColor ?? v.exteriorColor ?? ""}`, null);
        const [row] = await tx.insert(vehicles).values({ ...values, slug }).returning({ id: vehicles.id });
        id = row.id;
        createdId = id;
      }
      // Colours: update by id so photos stay linked, insert new, delete removed.
      const existing = await tx.select({ id: vehicleColors.id }).from(vehicleColors).where(eq(vehicleColors.vehicleId, id));
      const keep = new Set(v.colors.map((c) => c.id).filter(Boolean) as string[]);
      const remove = existing.map((c) => c.id).filter((cid) => !keep.has(cid));
      if (remove.length) await tx.delete(vehicleColors).where(inArray(vehicleColors.id, remove));
      for (const [position, c] of v.colors.entries()) {
        if (c.id && existing.some((e) => e.id === c.id)) {
          await tx.update(vehicleColors).set({ name: c.name, hex: c.hex, stockQuantity: c.stockQuantity, position }).where(eq(vehicleColors.id, c.id));
        } else {
          await tx.insert(vehicleColors).values({ vehicleId: id, name: c.name, hex: c.hex, stockQuantity: c.stockQuantity, position });
        }
      }
      await tx.delete(vehicleFeatures).where(eq(vehicleFeatures.vehicleId, id));
      const features = [...new Set(v.features)];
      if (features.length) await tx.insert(vehicleFeatures).values(features.map((name) => ({ vehicleId: id!, name })));
      await syncVehicleStock(tx, id);
    });
    return createdId ? undefined : "Vehicle saved.";
  });
  if (createdId) redirect(`/admin/vehicles/${createdId}?created=1`);
  return r;
}

export async function deleteVehicle(_: ActionState, fd: FormData): Promise<ActionState> {
  let deleted = false;
  const r = await run(async () => {
    await requireAdmin("inventory");
    const id = zId.parse(fd.get("id"));
    const [linkedSale] = await db.select({ id: sales.id }).from(sales).where(eq(sales.vehicleId, id)).limit(1);
    const [linkedOrder] = await db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.vehicleId, id)).limit(1);
    if (linkedSale || linkedOrder) {
      throw new UserError("This vehicle has orders or sales recorded against it. Unpublish it instead so financial history stays intact.");
    }
    const imgs = await db.select({ url: vehicleImages.url }).from(vehicleImages).where(eq(vehicleImages.vehicleId, id));
    await db.delete(vehicles).where(eq(vehicles.id, id));
    await Promise.all(imgs.map((i) => deleteImageUrl(i.url)));
    deleted = true;
  });
  if (deleted) redirect("/admin/vehicles?deleted=1");
  return r;
}

/** Quick status changes from the vehicle table ("mark sold / reserved / out of stock", feature). */
export async function quickVehicleUpdate(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("inventory");
    const id = zId.parse(fd.get("id"));
    const op = z.enum(["available", "reserved", "sold", "out_of_stock", "auto", "feature", "unfeature", "publish", "unpublish"]).parse(fd.get("op"));
    await db.transaction(async (tx) => {
      if (op === "auto") await tx.update(vehicles).set({ availabilityOverride: false }).where(eq(vehicles.id, id));
      else if (op === "feature" || op === "unfeature") await tx.update(vehicles).set({ featured: op === "feature" }).where(eq(vehicles.id, id));
      else if (op === "publish" || op === "unpublish") await tx.update(vehicles).set({ published: op === "publish" }).where(eq(vehicles.id, id));
      else await tx.update(vehicles).set({ availability: op, availabilityOverride: true }).where(eq(vehicles.id, id));
      await syncVehicleStock(tx, id);
    });
    const msg: Record<string, string> = { auto: "Availability now follows stock.", feature: "Featured on the homepage.", unfeature: "Removed from featured.", publish: "Listing published.", unpublish: "Listing hidden from the public site." };
    return msg[op] ?? `Marked as ${op.replace(/_/g, " ")}.`;
  });
}

/* ── images ────────────────────────────────────────────────────────────── */

export async function updateImage(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("inventory");
    const id = zId.parse(fd.get("id"));
    const op = z.enum(["featured", "up", "down", "delete", "meta"]).parse(fd.get("op"));
    const [img] = await db.select().from(vehicleImages).where(eq(vehicleImages.id, id)).limit(1);
    if (!img) throw new UserError("Photo not found.");
    if (op === "delete") {
      await db.delete(vehicleImages).where(eq(vehicleImages.id, id));
      await deleteImageUrl(img.url);
      if (img.isFeatured) {
        const [next] = await db.select().from(vehicleImages).where(eq(vehicleImages.vehicleId, img.vehicleId)).orderBy(asc(vehicleImages.position)).limit(1);
        if (next) await db.update(vehicleImages).set({ isFeatured: true }).where(eq(vehicleImages.id, next.id));
      }
      return "Photo removed.";
    }
    if (op === "featured") {
      await db.transaction(async (tx) => {
        await tx.update(vehicleImages).set({ isFeatured: false }).where(eq(vehicleImages.vehicleId, img.vehicleId));
        await tx.update(vehicleImages).set({ isFeatured: true }).where(eq(vehicleImages.id, id));
      });
      return "Featured photo updated.";
    }
    if (op === "meta") {
      const kind = z.enum(["front", "rear", "side", "interior", "dashboard", "engine", "other"]).parse(fd.get("kind"));
      const colorRaw = String(fd.get("colorId") ?? "");
      let colorId: string | null = null;
      if (colorRaw) {
        const [c] = await db.select({ id: vehicleColors.id }).from(vehicleColors).where(and(eq(vehicleColors.id, zId.parse(colorRaw)), eq(vehicleColors.vehicleId, img.vehicleId))).limit(1);
        if (!c) throw new UserError("That colour doesn't belong to this vehicle.");
        colorId = c.id;
      }
      await db.update(vehicleImages).set({ kind, colorId }).where(eq(vehicleImages.id, id));
      return "Photo details saved.";
    }
    // Reorder: normalise positions, then swap with the neighbour.
    await db.transaction(async (tx) => {
      const all = await tx.select({ id: vehicleImages.id }).from(vehicleImages).where(eq(vehicleImages.vehicleId, img.vehicleId)).orderBy(asc(vehicleImages.position), asc(vehicleImages.createdAt));
      const i = all.findIndex((x) => x.id === id);
      const j = op === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= all.length) return;
      [all[i], all[j]] = [all[j], all[i]];
      for (const [pos, row] of all.entries()) await tx.update(vehicleImages).set({ position: pos }).where(eq(vehicleImages.id, row.id));
    });
    return undefined;
  });
}

export async function nextStockNumber(): Promise<string> {
  await requireAdmin("inventory");
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(vehicles);
  return `AM-${String(1001 + r.n).padStart(4, "0")}`;
}
