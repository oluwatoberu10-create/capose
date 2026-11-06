import Link from "next/link";
import { AVAILABILITY_LABEL } from "@/lib/constants";

type BtnVariant = "primary" | "gold" | "outline" | "ghost" | "danger" | "light";
type BtnSize = "sm" | "md" | "lg";

const VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-ink text-white hover:bg-carbon",
  gold: "bg-gold-bright text-ink hover:bg-[#d6b97f]",
  outline: "border border-line bg-white text-ink hover:border-ink/40",
  ghost: "text-body hover:bg-mist",
  danger: "bg-bad text-white hover:bg-[#9a1d14]",
  light: "border border-white/25 bg-white/5 text-white backdrop-blur hover:bg-white/15",
};
const SIZES: Record<BtnSize, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function btn(variant: BtnVariant = "primary", size: BtnSize = "md", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({ variant, size, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return <button className={btn(variant, size, className)} {...props} />;
}

export function LinkButton({ href, variant, size, className = "", children, ...rest }: { href: string; variant?: BtnVariant; size?: BtnSize; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return <Link href={href} className={btn(variant, size, className)} {...rest}>{children}</Link>;
}

const TONES = {
  neutral: "bg-mist text-body ring-line",
  ok: "bg-[#e7f4ec] text-ok ring-[#cde8d8]",
  warn: "bg-[#fdf1df] text-warn ring-[#f6dfba]",
  bad: "bg-[#fdeceb] text-bad ring-[#f7d0cd]",
  gold: "bg-gold-soft text-gold ring-[#ead9b8]",
  dark: "bg-ink text-white ring-ink",
  info: "bg-[#e9eef8] text-[#28457a] ring-[#d3ddf0]",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}>{children}</span>;
}

const AVAIL_TONE = { available: "ok", reserved: "warn", sold: "dark", out_of_stock: "bad" } as const;
export function AvailabilityBadge({ value, className }: { value: keyof typeof AVAILABILITY_LABEL; className?: string }) {
  return <Badge tone={AVAIL_TONE[value]} className={className}>{value === "available" && <span className="size-1.5 rounded-full bg-ok" />}{AVAILABILITY_LABEL[value]}</Badge>;
}

export function StatusBadge({ value, map, labels }: { value: string; map: Record<string, Tone>; labels: Record<string, string> }) {
  return <Badge tone={map[value] ?? "neutral"}>{labels[value] ?? value}</Badge>;
}

export const ORDER_TONES: Record<string, Tone> = { pending: "warn", confirmed: "info", processing: "info", completed: "ok", cancelled: "bad" };
export const PAY_TONES: Record<string, Tone> = { pending: "warn", paid: "ok", failed: "bad", refunded: "neutral", unpaid: "bad", partially_paid: "warn", fully_paid: "ok" };
export const COMMISSION_TONES: Record<string, Tone> = { pending: "warn", approved: "info", paid: "ok", cancelled: "neutral" };
export const AGENT_TONES: Record<string, Tone> = { pending: "warn", approved: "ok", suspended: "bad" };

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-mist text-stone">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 13l2-6h14l2 6M5 13h14v5H5zM7 18v2M17 18v2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "gold" | "dark" | "bad" | "ok" }) {
  const dark = tone === "dark";
  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${dark ? "border-ink bg-ink text-white" : "border-line bg-white shadow-card"}`}>
      <p className={`text-[12px] font-medium ${dark ? "text-white/60" : "text-muted"}`}>{label}</p>
      <p className={`mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-[1.6rem] ${dark ? "text-white" : tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : tone === "gold" ? "text-gold" : "text-ink"}`}>{value}</p>
      {hint && <p className={`mt-1 text-[12px] ${dark ? "text-white/50" : "text-stone"}`}>{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">← {back.label}</Link>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, actions, children, className = "" }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          {title && <h2 className="text-[15px] font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Horizontally scrollable on phones so wide tables never break the layout. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="card overflow-hidden"><div className="overflow-x-auto">{children}</div></div>;
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-1.5">
      {page > 1 ? <Link href={href(page - 1)} className={btn("outline", "sm")}>← Prev</Link> : <span className={btn("outline", "sm", "opacity-40")}>← Prev</span>}
      <div className="hidden items-center gap-1.5 sm:flex">
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-stone">…</span>}
            <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`grid size-9 place-items-center rounded-lg text-sm ${n === page ? "bg-ink font-semibold text-white" : "text-body hover:bg-mist"}`}>{n}</Link>
          </span>
        ))}
      </div>
      <span className="px-2 text-sm text-muted sm:hidden">{page} / {pages}</span>
      {page < pages ? <Link href={href(page + 1)} className={btn("outline", "sm")}>Next →</Link> : <span className={btn("outline", "sm", "opacity-40")}>Next →</span>}
    </nav>
  );
}

export function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2.5 text-sm">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-medium text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Notice({ tone = "gold", children }: { tone?: "gold" | "warn" | "info" | "bad"; children: React.ReactNode }) {
  const t = { gold: "border-[#ead9b8] bg-gold-soft text-[#6b5326]", warn: "border-[#f6dfba] bg-[#fdf6ea] text-[#7a4a00]", info: "border-[#d3ddf0] bg-[#f1f5fc] text-[#28457a]", bad: "border-[#f7d0cd] bg-[#fdf1f0] text-bad" }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${t}`}>{children}</div>;
}
