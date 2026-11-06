import { eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { AuthError, requireAdmin } from "@/server/auth";
import { MIME_BY_EXT, readStored } from "@/server/storage";

/** Expense receipts are private: served only to admins with finance access. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin("finance");
  } catch (e) {
    return new Response(e instanceof AuthError ? e.message : "Unauthorised", { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [e] = await db.select({ path: expenses.receiptPath, name: expenses.receiptName }).from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!e?.path) return new Response("Not found", { status: 404 });
  const buf = await readStored("private", e.path);
  if (!buf) return new Response("Not found", { status: 404 });
  const ext = e.path.split(".").pop() ?? "";
  const name = (e.name ?? `receipt.${ext}`).replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": MIME_BY_EXT[ext] ?? "application/octet-stream",
      "content-disposition": `inline; filename="${name}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
