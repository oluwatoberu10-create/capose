import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { vehicleImages, vehicles } from "@/db/schema";
import { AuthError, requireAdmin } from "@/server/auth";
import { MAX_IMAGE_BYTES, mediaUrl, saveFile, sniff } from "@/server/storage";

/** Multipart upload of one or more vehicle photos (admin only). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin("inventory");
  } catch (e) {
    return NextResponse.json({ error: e instanceof AuthError ? e.message : "Unauthorised" }, { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad vehicle id" }, { status: 400 });
  const [v] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, id)).limit(1);
  if (!v) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "No files received" }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ error: "Upload at most 20 photos at a time" }, { status: 400 });
  const kind = String(form.get("kind") ?? "other");
  const colorId = String(form.get("colorId") ?? "") || null;

  const [{ max, featured }] = await db.select({
    max: sql<number>`coalesce(max(${vehicleImages.position}), -1)::int`,
    featured: sql<number>`count(*) filter (where ${vehicleImages.isFeatured})::int`,
  }).from(vehicleImages).where(eq(vehicleImages.vehicleId, id));

  const saved: string[] = [];
  const rejected: string[] = [];
  let pos = max + 1;
  let hasFeatured = featured > 0;
  for (const f of files) {
    if (f.size > MAX_IMAGE_BYTES) { rejected.push(`${f.name}: larger than 8 MB`); continue; }
    const buf = Buffer.from(await f.arrayBuffer());
    const type = sniff(buf);
    if (!type || type.ext === "pdf") { rejected.push(`${f.name}: not a JPG, PNG, WebP or AVIF image`); continue; }
    const rel = await saveFile("public", `vehicles/${id}`, buf, type.ext);
    await db.insert(vehicleImages).values({
      vehicleId: id, url: mediaUrl(rel), position: pos++, isFeatured: !hasFeatured,
      kind: (["front", "rear", "side", "interior", "dashboard", "engine", "other"].includes(kind) ? kind : "other") as "other",
      colorId: colorId && /^[0-9a-f-]{36}$/i.test(colorId) ? colorId : null,
    });
    hasFeatured = true;
    saved.push(f.name);
  }
  return NextResponse.json({ saved: saved.length, rejected });
}
