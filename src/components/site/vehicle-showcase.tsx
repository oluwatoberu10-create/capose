"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { AvailabilityBadge, Badge, btn } from "@/components/ui";
import { CONDITION_LABEL, IMAGE_KIND_LABEL } from "@/lib/constants";
import { km, naira } from "@/lib/format";
import { notifyWhenAvailable } from "@/server/actions/public";
import type { PublicVehicle } from "@/server/services/vehicles";
import { ContactForm } from "./contact-form";
import { SaveButton, ShareButton } from "./saved";
import { CarPlaceholder } from "./vehicle-card";

const INTERIOR_KINDS = new Set(["interior", "dashboard"]);

type Props = { v: PublicVehicle; price: number; was: number | null; whatsappHref: string; orderable: boolean };

export function VehicleShowcase({ v, price, was, whatsappHref, orderable }: Props) {
  const [colorId, setColorId] = useState<string | null>(() => v.colors.find((c) => c.stockQuantity === null || c.stockQuantity > 0)?.id ?? v.colors[0]?.id ?? null);
  const color = v.colors.find((c) => c.id === colorId) ?? null;

  // The chosen colour's own photos (exterior and interior), followed by photos tagged "All colours".
  // A colour without photos yet falls back to the general photos, or to the first colour that has some.
  const colorImages = useMemo(() => {
    const general = v.images.filter((i) => !i.colorId);
    const own = color ? v.images.filter((i) => i.colorId === color.id) : [];
    if (own.length) return [...own, ...general];
    if (general.length) return general;
    const firstTagged = v.images[0]?.colorId;
    return v.images.filter((i) => i.colorId === firstTagged);
  }, [color, v.images]);
  // When the chosen colour has no photos yet, say which colour the shown photo actually is.
  const shownColor = color && colorImages.length && colorImages.every((i) => i.colorId && i.colorId !== color.id)
    ? v.colors.find((c) => c.id === colorImages[0].colorId)?.name ?? null : null;

  // Exterior / interior tabs, shown only when the chosen colour has both kinds of photo.
  const [view, setView] = useState<"all" | "exterior" | "interior">("all");
  const counts = useMemo(() => {
    const interior = colorImages.filter((i) => INTERIOR_KINDS.has(i.kind)).length;
    return { all: colorImages.length, interior, exterior: colorImages.length - interior };
  }, [colorImages]);
  const showTabs = counts.interior > 0 && counts.exterior > 0;
  const images = useMemo(() => {
    if (!showTabs || view === "all") return colorImages;
    return colorImages.filter((i) => INTERIOR_KINDS.has(i.kind) === (view === "interior"));
  }, [colorImages, view, showTabs]);

  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [colorId, view]);
  const current = images[index];
  const go = (d: number) => setIndex((i) => (images.length ? (i + d + images.length) % images.length : 0));

  const [touchX, setTouchX] = useState<number | null>(null);
  const [modal, setModal] = useState<null | "info" | "notify">(null);
  const colorOut = color?.stockQuantity === 0;
  const canOrder = orderable && !colorOut;
  const stockNote = color && color.stockQuantity !== null
    ? color.stockQuantity === 0 ? `${color.name} is currently out of stock` : `${color.stockQuantity} in ${color.name} available`
    : orderable ? `${v.stockQuantity} unit${v.stockQuantity === 1 ? "" : "s"} available` : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
      {/* Gallery */}
      <div className="min-w-0">
        <div className="relative aspect-[16/11] overflow-hidden rounded-2xl bg-mist sm:aspect-[16/10]"
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); setTouchX(null); }}>
          {current ? (
            <Image key={current.id} src={current.url} alt={`${v.title} — ${IMAGE_KIND_LABEL[current.kind]}`} fill priority sizes="(min-width:1024px) 60vw, 100vw" className="animate-fade-up object-cover" />
          ) : <CarPlaceholder className="absolute inset-0" />}
          <div className="absolute top-4 left-4 flex gap-2"><AvailabilityBadge value={v.availability} className="shadow-sm" /></div>
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white">‹</button>
              <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow transition hover:bg-white">›</button>
              <span className="absolute right-4 bottom-4 rounded-full bg-ink/70 px-2.5 py-1 text-xs text-white">{index + 1} / {images.length}</span>
            </>
          )}
        </div>
        {showTabs && (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="tablist" aria-label="Photo view">
            {(["all", "exterior", "interior"] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${view === k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-stone"}`}>
                {k === "all" ? "All photos" : k === "exterior" ? "Exterior" : "Interior"} <span className="opacity-60">{counts[k]}</span>
              </button>
            ))}
            {color && <span className="text-[12.5px] text-muted">{color.name}</span>}
          </div>
        )}
        {images.length > 1 && (
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button key={img.id} type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index}
                className={`relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:w-28 ${i === index ? "ring-gold" : "ring-transparent opacity-70 hover:opacity-100"}`}>
                <Image src={img.url} alt="" fill sizes="112px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary & actions */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="eyebrow">{v.brand}</p>
        <h1 className="mt-2 text-3xl leading-tight font-semibold sm:text-4xl">{v.model}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{v.year}</span><span className="text-line">•</span><span>{CONDITION_LABEL[v.condition]}</span><span className="text-line">•</span><span>Stock #{v.stockNumber}</span>
        </div>
        <div className="mt-5 flex items-baseline gap-3">
          <p className="font-display text-[2rem] font-semibold tabular-nums text-ink">{naira(price)}</p>
          {was && <p className="text-base text-stone line-through tabular-nums">{naira(was)}</p>}
          {was && <Badge tone="gold">Save {naira(was - price)}</Badge>}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
          {[["Mileage", v.mileage !== null ? km(v.mileage) : "—"], ["Transmission", v.transmission], ["Fuel", v.fuelType], ["Engine", [v.engineCapacity, v.engineType].filter(Boolean).join(" ") || null]].map(([k, val]) => (
            <div key={k} className="bg-white px-4 py-3"><dt className="text-[12px] text-stone">{k}</dt><dd className="mt-0.5 font-medium text-ink">{val || "—"}</dd></div>
          ))}
        </dl>

        {v.colors.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-ink">Colour: <span className="font-normal text-muted">{color?.name}</span></p>
            <div className="mt-3 flex flex-wrap gap-2.5" role="radiogroup" aria-label="Choose colour">
              {v.colors.map((c) => {
                const out = c.stockQuantity === 0;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={c.id === colorId} aria-label={`${c.name}${out ? " (out of stock)" : ""}`} title={`${c.name}${out ? " — out of stock" : ""}`} onClick={() => setColorId(c.id)}
                    className={`relative size-10 rounded-full ring-2 ring-offset-2 transition ${c.id === colorId ? "ring-gold" : "ring-transparent hover:ring-line"}`}>
                    <span className="absolute inset-0 rounded-full border border-black/10" style={{ background: c.hex }} />
                    {out && <span className="absolute inset-0 grid place-items-center"><span className="h-0.5 w-11 rotate-45 bg-bad" /></span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {color && shownColor && <p className="mt-3 text-[13px] text-muted">Photos of the {color.name} car are coming soon — pictured in {shownColor}.</p>}
        {stockNote && <p className={`mt-4 text-sm ${colorOut ? "text-bad" : "text-ok"}`}>{stockNote}</p>}

        <div className="mt-6 grid gap-2.5">
          {canOrder ? (
            <Link href={`/cars/${v.slug}/order${colorId ? `?color=${colorId}` : ""}`} className={btn("primary", "lg", "w-full")}>Order this car</Link>
          ) : (
            <button type="button" onClick={() => setModal("notify")} className={btn("primary", "lg", "w-full")}>Notify me when available</button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setModal("info")} className={btn("outline", "md", "w-full")}>{canOrder ? "Request info" : "Contact dealer"}</button>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={btn("gold", "md", "w-full")}>WhatsApp</a>
            <ShareButton path={`/cars/${v.slug}`} title={v.title} variant="full" />
            <SaveButton vehicleId={v.id} variant="full" className="w-full" />
          </div>
        </div>
        {!orderable && <p className="mt-3 text-[13px] text-muted">This car is {v.availability === "reserved" ? "reserved for another buyer" : v.availability === "sold" ? "sold" : "out of stock"}. Leave your details and we&apos;ll contact you when it — or a similar car — is available.</p>}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={() => setModal(null)}>
          <div className="animate-toast max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-lift sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{modal === "info" ? "Request more information" : "Notify me when available"}</h2>
                <p className="mt-1 text-sm text-muted">{v.title}</p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-mist" aria-label="Close">✕</button>
            </div>
            {modal === "info" ? <ContactForm vehicleId={v.id} vehicleTitle={v.title} /> : (
              <ActionForm action={notifyWhenAvailable} resetOnSuccess onSuccess={() => setModal(null)} className="grid gap-4">
                <input type="hidden" name="vehicleId" value={v.id} />
                <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                <Field label="Full name" name="name" required><input id="name" name="name" className="field" autoComplete="name" /></Field>
                <Field label="Phone number" name="phone" required><input id="phone" name="phone" type="tel" className="field" autoComplete="tel" placeholder="0803 000 0000" /></Field>
                <Field label="Email (optional)" name="email"><input id="email" name="email" type="email" className="field" autoComplete="email" /></Field>
                <SubmitButton size="lg" pending="Saving…">Notify me</SubmitButton>
              </ActionForm>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
