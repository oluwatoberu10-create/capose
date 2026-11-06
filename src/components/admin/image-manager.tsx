"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ActionForm, ConfirmAction, InlineAction, SubmitButton } from "@/components/form";
import { Badge, btn } from "@/components/ui";
import { useToast } from "@/components/toast";
import { IMAGE_KIND_LABEL } from "@/lib/constants";
import { updateImage } from "@/server/actions/admin-vehicles";

type Img = { id: string; url: string; kind: keyof typeof IMAGE_KIND_LABEL; colorId: string | null; isFeatured: boolean };
type Color = { id: string; name: string; hex: string };

/**
 * Shrinks a photo in the browser before upload (longest side 2400px, JPEG 85%).
 * Keeps requests well under hosting limits (Vercel caps request bodies at ~4.5 MB)
 * and makes pages load faster. Files that can't be decoded are sent unchanged.
 */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 900_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function ImageManager({ vehicleId, images, colors }: { vehicleId: string; images: Img[]; colors: Color[] }) {
  const router = useRouter();
  const push = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("other");
  const [colorId, setColorId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(`Uploading ${list.length} photo${list.length > 1 ? "s" : ""}…`);
    try {
      // One photo per request, resized first, so uploads stay under hosting body-size limits.
      let saved = 0;
      const rejected: string[] = [];
      for (let i = 0; i < list.length; i++) {
        const fd = new FormData();
        fd.append("files", await shrink(list[i]));
        fd.set("kind", kind);
        fd.set("colorId", colorId);
        const res = await fetch(`/api/admin/vehicles/${vehicleId}/images`, { method: "POST", body: fd });
        const json = (await res.json().catch(() => ({}))) as { saved?: number; rejected?: string[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        saved += json.saved ?? 0;
        rejected.push(...(json.rejected ?? []));
        setBusy(`Uploaded ${saved} of ${list.length}…`);
      }
      if (saved) push(`${saved} photo${saved > 1 ? "s" : ""} uploaded`);
      if (rejected.length) push(`Skipped: ${rejected.join("; ")}`, "error");
      router.refresh();
    } catch (e) {
      push(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="card">
      <div className="border-b border-line px-4 py-3.5 sm:px-6">
        <h2 className="text-[15px] font-semibold">Photos</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">Upload front, rear, side, interior, dashboard and engine shots. The featured photo is used on cards and listings.</p>
        {colors.length > 0 && (
          <p className="mt-1.5 text-[12.5px] text-muted">
            <strong className="font-medium text-ink">Photos per colour:</strong> choose a colour, choose the photo type, then select as many photos as you like at once. Do the exterior shots and the interior shots as two uploads. Customers see that colour&apos;s photos when they tap its swatch, with Exterior / Interior tabs. Photos left on “All colours” show for every colour.
          </p>
        )}
      </div>
      <div className="p-4 sm:p-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}
          className={`rounded-xl border-2 border-dashed p-5 text-center transition ${drag ? "border-gold bg-gold-soft/50" : "border-line bg-mist/40"}`}>
          <div className="mx-auto flex max-w-md flex-col gap-2 sm:flex-row">
            <select aria-label="Photo type" className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(IMAGE_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l} view</option>)}
            </select>
            {colors.length > 0 && (
              <select aria-label="Colour" className="field" value={colorId} onChange={(e) => setColorId(e.target.value)}>
                <option value="">All colours</option>
                {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} />
          <button type="button" disabled={!!busy} onClick={() => input.current?.click()} className={btn("primary", "md", "mt-3")}>
            {busy ? <><span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />{busy}</> : "Choose photos"}
          </button>
          <p className="mt-2 text-[12px] text-stone">Select several at once, or drag & drop · JPG, PNG, WebP, AVIF · up to 8 MB each</p>
        </div>
        {colors.length > 0 && images.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
            {[...colors.map((c) => ({ key: c.id, name: c.name, hex: c.hex as string | null })), { key: "", name: "All colours", hex: null }].map((c) => {
              const list = images.filter((i) => (i.colorId ?? "") === c.key);
              if (!c.key && !list.length) return null;
              const interior = list.filter((i) => i.kind === "interior" || i.kind === "dashboard").length;
              return (
                <span key={c.key || "all"} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${list.length ? "border-line bg-white" : "border-bad/30 bg-[#fdf2f2] text-bad"}`}>
                  {c.hex && <span className="size-3 rounded-full border border-black/10" style={{ background: c.hex }} />}
                  {c.name}: {list.length ? `${list.length - interior} exterior · ${interior} interior` : "no photos yet"}
                </span>
              );
            })}
          </div>
        )}

        {images.length === 0 ? <p className="mt-5 text-center text-sm text-muted">No photos yet.</p> : (
          <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img, i) => (
              <li key={img.id} className="overflow-hidden rounded-xl border border-line bg-white">
                <div className="relative aspect-[4/3] bg-mist">
                  <Image src={img.url} alt="" fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover" />
                  <div className="absolute top-2 left-2 flex gap-1.5">
                    <Badge tone="dark">#{i + 1}</Badge>
                    {img.isFeatured && <Badge tone="gold">★ Featured</Badge>}
                    {(() => { const c = colors.find((x) => x.id === img.colorId); return c ? <Badge tone="dark"><span className="mr-1 inline-block size-2.5 rounded-full border border-white/40 align-middle" style={{ background: c.hex }} />{c.name}</Badge> : null; })()}
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <ActionForm action={updateImage} className="flex gap-1.5" toast={false}>
                    <input type="hidden" name="id" value={img.id} /><input type="hidden" name="op" value="meta" />
                    <select name="kind" defaultValue={img.kind} aria-label="Photo type" className="field h-9 py-1 text-[13px]">
                      {Object.entries(IMAGE_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {colors.length > 0 && (
                      <select name="colorId" defaultValue={img.colorId ?? ""} aria-label="Colour" className="field h-9 py-1 text-[13px]">
                        <option value="">All colours</option>
                        {colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                    <SubmitButton size="sm" variant="outline" pending="…">Save</SubmitButton>
                  </ActionForm>
                  <div className="flex flex-wrap gap-1.5">
                    {!img.isFeatured && <InlineAction action={updateImage} fields={{ id: img.id, op: "featured" }}>★ Make featured</InlineAction>}
                    {i > 0 && <InlineAction action={updateImage} fields={{ id: img.id, op: "up" }}>←</InlineAction>}
                    {i < images.length - 1 && <InlineAction action={updateImage} fields={{ id: img.id, op: "down" }}>→</InlineAction>}
                    <ConfirmAction action={updateImage} fields={{ id: img.id, op: "delete" }} label="Remove" confirmTitle="Remove this photo?" confirmBody="The file is deleted and cannot be recovered." confirmLabel="Remove photo" className="ml-auto" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
