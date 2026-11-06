import Image from "next/image";
import Link from "next/link";
import { AvailabilityBadge, Badge } from "@/components/ui";
import { CONDITION_LABEL } from "@/lib/constants";
import { publicPrice } from "@/lib/finance";
import { km, naira } from "@/lib/format";
import type { VehicleCard as Card } from "@/server/services/vehicles";
import { SaveButton, ShareButton } from "./saved";

export function CarPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`grid place-items-center bg-gradient-to-br from-mist to-line text-stone ${className}`}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1"><path d="M3 13l2-6h14l2 6M5 13h14v5H5zM7 18v2M17 18v2M7.5 15.5h1M15.5 15.5h1" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

export function VehicleCard({ v, priority }: { v: Card; priority?: boolean }) {
  const { price, was } = publicPrice(v);
  const unavailable = v.availability === "sold" || v.availability === "out_of_stock";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <Link href={`/cars/${v.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-mist" aria-label={`${v.year} ${v.brand} ${v.model}`}>
        {v.cover ? (
          <Image src={v.cover} alt={`${v.year} ${v.brand} ${v.model}`} fill sizes="(min-width:1280px) 25vw, (min-width:768px) 33vw, (min-width:640px) 50vw, 100vw" priority={priority}
            className={`object-cover transition duration-700 group-hover:scale-[1.04] ${unavailable ? "grayscale-[35%]" : ""}`} />
        ) : <CarPlaceholder className="absolute inset-0" />}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <AvailabilityBadge value={v.availability} className="shadow-sm" />
          {v.featured && v.availability === "available" && <Badge tone="dark" className="shadow-sm">Featured</Badge>}
        </div>
      </Link>
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        <ShareButton path={`/cars/${v.slug}`} title={`${v.year} ${v.brand} ${v.model}`} />
        <SaveButton vehicleId={v.id} />
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">{v.brand}</p>
        <h3 className="mt-1 line-clamp-1 text-[17px] font-semibold">
          <Link href={`/cars/${v.slug}`} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">{v.model}</Link>
        </h3>
        <p className="mt-0.5 text-[13px] text-muted">{v.year} · {CONDITION_LABEL[v.condition]}</p>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="font-display text-xl font-semibold tabular-nums text-ink">{naira(price)}</p>
          {was && <p className="text-[13px] text-stone line-through tabular-nums">{naira(was)}</p>}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-[12px]">
          <Spec label="Mileage" value={v.mileage !== null ? km(v.mileage) : "—"} />
          <Spec label="Gearbox" value={v.transmission ?? "—"} />
          <Spec label="Fuel" value={v.fuelType ?? "—"} />
        </dl>
        <span className="relative mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-line text-[13px] font-medium text-ink transition group-hover:border-ink group-hover:bg-ink group-hover:text-white">View details</span>
      </div>
    </article>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-stone">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-body">{value}</dd>
    </div>
  );
}

export function VehicleGrid({ items, priorityFirst, narrow }: { items: Card[]; priorityFirst?: boolean; narrow?: boolean }) {
  return (
    <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${narrow ? "xl:grid-cols-3" : "lg:grid-cols-3 xl:grid-cols-4"}`}>
      {items.map((v, i) => <VehicleCard key={v.id} v={v} priority={priorityFirst && i < 2} />)}
    </div>
  );
}

export function VehicleGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="skeleton aspect-[4/3] rounded-none" />
          <div className="space-y-3 p-5"><div className="skeleton h-3 w-16" /><div className="skeleton h-5 w-2/3" /><div className="skeleton h-6 w-1/2" /><div className="skeleton h-10 w-full" /></div>
        </div>
      ))}
    </div>
  );
}
