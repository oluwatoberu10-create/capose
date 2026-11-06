"use server";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { customerNotifications, enquiries, savedListings, vehicles } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { getPrincipal } from "@/server/auth";
import { createOrder } from "@/server/services/orders";
import { cardsByIds, type VehicleCard } from "@/server/services/vehicles";
import { formObject, run, UserError, zOptEmail, zOptId, zOptText, zPhone, zText } from "./util";

const REF_COOKIE = "am_ref";

/* ── per-process rate limit for anonymous forms ───────────────────────── */
const hits = new Map<string, number[]>();
function limit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) throw new UserError("Too many submissions — please wait a few minutes and try again.");
  arr.push(now);
  hits.set(key, arr);
}
async function clientKey() {
  const { headers } = await import("next/headers");
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

const orderSchema = z.object({
  vehicleId: z.string().uuid("Vehicle missing."),
  colorId: zOptId,
  quantity: z.coerce.number().int("Choose a quantity.").min(1, "Choose at least 1.").max(10, "For more than 10 units, please contact us directly."),
  name: zText("Full name", 120),
  phone: zPhone,
  email: zOptEmail,
  message: zOptText(1500),
  ref: z.string().optional(),
  website: z.string().optional(), // honeypot
});

export async function submitOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  let token: string | null = null;
  const result = await run(async () => {
    const input = orderSchema.parse(formObject(fd));
    if (input.website) throw new UserError("Submission rejected.");
    limit(`order:${await clientKey()}`, 8, 10 * 60_000);
    const cookieRef = (await cookies()).get(REF_COOKIE)?.value ?? null;
    const order = await createOrder({
      vehicleId: input.vehicleId, colorId: input.colorId, quantity: input.quantity, name: input.name, phone: input.phone,
      email: input.email, message: input.message, referralCode: cookieRef ?? input.ref ?? null,
    });
    token = order.accessToken;
  });
  if (token) redirect(`/order/${token}`);
  return result;
}

const enquirySchema = z.object({
  kind: z.enum(["contact", "vehicle_info"]),
  vehicleId: zOptId,
  name: zText("Name", 120),
  phone: z.string().optional().transform((s) => s?.trim() || null),
  email: zOptEmail,
  message: zText("Message", 3000),
  website: z.string().optional(),
}).refine((v) => v.phone || v.email, { message: "Give us a phone number or an email so we can reply.", path: ["phone"] });

export async function submitEnquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const input = enquirySchema.parse(formObject(fd));
    if (input.website) throw new UserError("Submission rejected.");
    limit(`enq:${await clientKey()}`, 6, 10 * 60_000);
    const { website: _w, ...row } = input;
    await db.insert(enquiries).values(row);
    return "Thank you — your message has been sent. We'll get back to you shortly.";
  });
}

const notifySchema = z.object({ vehicleId: z.string().uuid(), name: zText("Name", 120), phone: zPhone, email: zOptEmail, website: z.string().optional() });

export async function notifyWhenAvailable(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const input = notifySchema.parse(formObject(fd));
    if (input.website) throw new UserError("Submission rejected.");
    limit(`notify:${await clientKey()}`, 6, 10 * 60_000);
    const [v] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1);
    if (!v) throw new UserError("This vehicle is no longer listed.");
    await db.insert(customerNotifications).values({ vehicleId: v.id, name: input.name, phone: input.phone, email: input.email });
    return "Done — we'll contact you as soon as this car is available again.";
  });
}

/** Mirrors a save/unsave to the signed-in agent's account. No-op for visitors. */
export async function toggleSavedOnAccount(vehicleId: string, save: boolean): Promise<void> {
  const p = await getPrincipal();
  if (!p || p.kind !== "agent" || !z.string().uuid().safeParse(vehicleId).success) return;
  if (save) await db.insert(savedListings).values({ userId: p.userId, vehicleId }).onConflictDoNothing();
  else await db.delete(savedListings).where(and(eq(savedListings.userId, p.userId), eq(savedListings.vehicleId, vehicleId)));
}

/** Cards for the Saved page: the browser's list, plus the agent's account list when signed in. */
export async function savedCards(localIds: string[]): Promise<{ cards: VehicleCard[]; accountIds: string[] }> {
  const ids = localIds.filter((x) => z.string().uuid().safeParse(x).success).slice(0, 100);
  const p = await getPrincipal();
  let accountIds: string[] = [];
  if (p?.kind === "agent") {
    accountIds = (await db.select({ id: savedListings.vehicleId }).from(savedListings).where(eq(savedListings.userId, p.userId))).map((r) => r.id);
  }
  const all = [...new Set([...ids, ...accountIds])];
  const cards = await cardsByIds(all);
  return { cards: all.map((id) => cards.find((c) => c.id === id)).filter((c): c is VehicleCard => !!c), accountIds };
}
