"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { monthName } from "@/lib/format";

function useNav() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (!("page" in patch)) next.delete("page");
    start(() => router.push(`${path}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  return { params, set, pending };
}

/** Month + year selector. `allowAll` adds a "Whole year" option. */
export function PeriodFilter({ year, month, allowAll = true }: { year: number; month: number | null; allowAll?: boolean }) {
  const { set, pending } = useNav();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);
  return (
    <div className="flex items-center gap-2">
      <select aria-label="Month" className="field h-10 w-auto py-1.5" value={month ?? "all"} onChange={(e) => set({ month: e.target.value, year: String(year) })}>
        {allowAll && <option value="all">Whole year</option>}
        {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>)}
      </select>
      <select aria-label="Year" className="field h-10 w-auto py-1.5" value={year} onChange={(e) => set({ year: e.target.value, month: month ? String(month) : "all" })}>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-gold border-r-transparent" aria-label="Loading" />}
    </div>
  );
}

/** Search box + optional status select for admin tables. */
export function TableFilters({ placeholder = "Search…", statuses, statusKey = "status", extra }: {
  placeholder?: string; statuses?: { value: string; label: string }[]; statusKey?: string;
  extra?: { key: string; label: string; options: { value: string; label: string }[] }[];
}) {
  const { params, set, pending } = useNav();
  const [q, setQ] = useState(params.get("q") ?? "");
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <form role="search" className="relative flex-1" onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() || null }); }}>
        <svg className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => (q.trim() || null) !== (params.get("q") || null) && set({ q: q.trim() || null })} placeholder={placeholder} aria-label="Search" className="field h-10 pl-9" />
      </form>
      <div className="flex flex-wrap gap-2">
        {statuses && (
          <select aria-label="Status" className="field h-10 w-auto py-1.5" value={params.get(statusKey) ?? ""} onChange={(e) => set({ [statusKey]: e.target.value || null })}>
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
        {extra?.map((x) => (
          <select key={x.key} aria-label={x.label} className="field h-10 w-auto max-w-[220px] py-1.5" value={params.get(x.key) ?? ""} onChange={(e) => set({ [x.key]: e.target.value || null })}>
            <option value="">{x.label}: all</option>
            {x.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {pending && <span className="size-4 self-center animate-spin rounded-full border-2 border-gold border-r-transparent" />}
      </div>
    </div>
  );
}
