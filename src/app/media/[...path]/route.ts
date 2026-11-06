import { MIME_BY_EXT, readStored } from "@/server/storage";

/** Serves uploaded vehicle photos. Receipts live in a separate private area and are never served here. */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.join("/");
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_BY_EXT[ext];
  if (!mime || mime === "application/pdf" || !/^vehicles\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z]+$/i.test(rel)) return new Response("Not found", { status: 404 });
  const buf = await readStored("public", rel);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { "content-type": mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
}
