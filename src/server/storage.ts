import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, normalize, resolve, sep } from "node:path";
import { del, get, put } from "@vercel/blob";

/**
 * File storage.
 *
 *  - `public/`  vehicle photos, served by /media/[...path]
 *  - `private/` expense receipts, served only through an admin-checked route
 *
 * Local disk by default. When BLOB_READ_WRITE_TOKEN is set (a Vercel Blob store
 * connected to the project) files go to a *private* Blob store instead — the
 * app still serves them through its own routes, so access rules don't change.
 */
const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const blobKey = (scope: "public" | "private", rel: string) => {
  const clean = normalize(rel).split(sep).join("/");
  if (clean.startsWith("..") || clean.startsWith("/")) throw new Error("Invalid path");
  return `${scope}/${clean}`;
};
const ROOT = resolve(process.env.UPLOADS_DIR ?? ".uploads");

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024; // Vercel request bodies are capped at ~4.5 MB

type Sniffed = { ext: string; mime: string };

/** Identify a file by its magic bytes — the browser-supplied type is not trusted. */
export function sniff(buf: Buffer): Sniffed | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  if (buf.subarray(4, 12).toString("ascii").startsWith("ftypavif")) return { ext: "avif", mime: "image/avif" };
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return { ext: "pdf", mime: "application/pdf" };
  return null;
}

export const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", pdf: "application/pdf" };

function safePath(scope: "public" | "private", rel: string): string {
  const base = join(ROOT, scope);
  const full = resolve(base, normalize(rel));
  if (!full.startsWith(base + sep)) throw new Error("Invalid path");
  return full;
}

export async function saveFile(scope: "public" | "private", folder: string, buf: Buffer, ext: string): Promise<string> {
  const rel = `${folder}/${randomUUID()}.${ext}`;
  if (blobEnabled()) {
    await put(blobKey(scope, rel), buf, { access: "private", contentType: MIME_BY_EXT[ext], addRandomSuffix: false });
    return rel;
  }
  const full = safePath(scope, rel);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, buf);
  return rel;
}

export async function readStored(scope: "public" | "private", rel: string): Promise<Buffer | null> {
  try {
    if (blobEnabled()) {
      const r = await get(blobKey(scope, rel), { access: "private" });
      if (!r || r.statusCode !== 200 || !r.stream) return null;
      return Buffer.from(await new Response(r.stream).arrayBuffer());
    }
    return await readFile(safePath(scope, rel));
  } catch {
    return null;
  }
}

export async function deleteStored(scope: "public" | "private", rel: string): Promise<void> {
  try {
    if (blobEnabled()) { await del(blobKey(scope, rel)); return; }
    await unlink(safePath(scope, rel));
  } catch {
    /* already gone */
  }
}

/** Public URL for a stored vehicle photo. Demo photos live in /public/demo and are used as-is. */
export const mediaUrl = (rel: string) => `/media/${rel}`;

/** Deletes the file behind a vehicle image URL if it is one of ours. */
export async function deleteImageUrl(url: string): Promise<void> {
  if (url.startsWith("/media/")) await deleteStored("public", url.slice("/media/".length));
}
