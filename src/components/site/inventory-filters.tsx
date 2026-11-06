"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { btn } from "@/components/ui";
import { AVAILABILITY_LABEL, CONDITION_LABEL } from "@/lib/constants";

type Facets = { brands: string[]; models: { brand: string; model: string }[]; years: number[]; transmissions: string[]; fuels: string[]; bodies: string[] };

const PRICE_STEPS = [5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500];
const FILTER_KEYS = ["q", "brand", "model", "yearMin", "yearMax", "priceMin", "priceMax", "condition", "transmission", "fuel", "body", "availability"];

export function useInventoryNav() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    next.delete("page");
    start(() => router.push(`${path}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return { params, set, pending };
}

function FilterFields({ facets }: { facets: Facets }) {
  const { params, set } = useInventoryNav();
  const v = (k: string) => params.get(k) ?? "";
  const brand = v("brand");
  const models = facets.models.filter((m) => !brand || m.brand.toLowerCase() === brand.toLowerCase());
  const sel = (key: string, label: string, options: { value: string; label: string }[]) => (
    <div>
      <label htmlFor={`f-${key}`} className="label">{label}</label>
      <select id={`f-${key}`} className="field" value={v(key)} onChange={(e) => set({ [key]: e.target.value, ...(key === "brand" ? { model: null } : {}) })}>
        <option value="">Any</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
  return (
    <div className="space-y-4">
      {sel("brand", "Brand", facets.brands.map((b) => ({ value: b, label: b })))}
      {sel("model", "Model", models.map((m) => ({ value: m.model, label: m.model })))}
      <div>
        <span className="label">Year</span>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Year from" className="field" value={v("yearMin")} onChange={(e) => set({ yearMin: e.target.value })}>
            <option value="">From</option>{facets.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select aria-label="Year to" className="field" value={v("yearMax")} onChange={(e) => set({ yearMax: e.target.value })}>
            <option value="">To</option>{facets.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <div>
        <span className="label">Price</span>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Minimum price" className="field" value={v("priceMin")} onChange={(e) => set({ priceMin: e.target.value })}>
            <option value="">Min</option>{PRICE_STEPS.map((m) => <option key={m} value={m * 1e6}>₦{m}M</option>)}
          </select>
          <select aria-label="Maximum price" className="field" value={v("priceMax")} onChange={(e) => set({ priceMax: e.target.value })}>
            <option value="">Max</option>{PRICE_STEPS.map((m) => <option key={m} value={m * 1e6}>₦{m}M</option>)}
          </select>
        </div>
      </div>
      {sel("condition", "Condition", Object.entries(CONDITION_LABEL).map(([value, label]) => ({ value, label })))}
      {sel("transmission", "Transmission", facets.transmissions.map((t) => ({ value: t, label: t })))}
      {sel("fuel", "Fuel type", facets.fuels.map((t) => ({ value: t, label: t })))}
      {sel("body", "Body type", facets.bodies.map((t) => ({ value: t, label: t })))}
      {sel("availability", "Availability", Object.entries(AVAILABILITY_LABEL).map(([value, label]) => ({ value, label })))}
    </div>
  );
}

export function activeFilterCount(params: URLSearchParams) {
  return FILTER_KEYS.filter((k) => k !== "q" && params.get(k)).length;
}

export function InventorySidebar({ facets }: { facets: Facets }) {
  const { params, set, pending } = useInventoryNav();
  const count = activeFilterCount(params);
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 rounded-xl border border-line bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display font-semibold text-ink">Filters {pending && <span className="ml-1 inline-block size-3 animate-spin rounded-full border-2 border-gold border-r-transparent align-middle" />}</p>
          {count > 0 && <button type="button" className="text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => set(Object.fromEntries(FILTER_KEYS.filter((k) => k !== "q").map((k) => [k, null])))}>Clear all</button>}
        </div>
        <FilterFields facets={facets} />
      </div>
    </aside>
  );
}

export function InventoryToolbar({ facets, total }: { facets: Facets; total: number }) {
  const { params, set, pending } = useInventoryNav();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(params);

  useEffect(() => setQ(params.get("q") ?? ""), [params]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="relative flex-1" role="search" onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() || null }); }}>
          <svg className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand, model or year…" aria-label="Search cars" className="field h-12 pr-24 pl-10" />
          <button className={btn("primary", "sm", "absolute top-1/2 right-1.5 -translate-y-1/2")}>Search</button>
        </form>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(true)} className={btn("outline", "md", "h-12 flex-1 lg:hidden")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            Filters{count > 0 && <span className="grid size-5 place-items-center rounded-full bg-ink text-[11px] text-white">{count}</span>}
          </button>
          <select aria-label="Sort" className="field h-12 w-auto flex-1 sm:flex-none" value={params.get("sort") ?? "newest"} onChange={(e) => set({ sort: e.target.value === "newest" ? null : e.target.value })}>
            <option value="newest">Newest first</option>
            <option value="price_asc">Lowest price</option>
            <option value="price_desc">Highest price</option>
          </select>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted" aria-live="polite">{pending ? "Updating…" : `${total} ${total === 1 ? "car" : "cars"} found`}</p>

      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="animate-toast absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="font-display text-lg font-semibold text-ink">Filters</p>
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg hover:bg-mist" aria-label="Close filters">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5"><FilterFields facets={facets} /></div>
            <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
              <button type="button" className={btn("outline", "lg")} onClick={() => set(Object.fromEntries(FILTER_KEYS.filter((k) => k !== "q").map((k) => [k, null])))}>Clear</button>
              <button type="button" className={btn("primary", "lg")} onClick={() => setOpen(false)}>{pending ? "Updating…" : `Show ${total} cars`}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
