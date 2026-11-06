/** Display helpers shared by server and client code. */

const nairaFmt = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

/** ₦45,000,000 */
export function naira(amount: number | null | undefined): string {
  const n = Math.round(Number(amount ?? 0));
  return `${n < 0 ? "−" : ""}₦${nairaFmt.format(Math.abs(n))}`;
}

/** Compact form for chart axes: ₦45M, ₦850K. */
export function nairaCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}₦${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}₦${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}₦${trim(abs / 1e3)}K`;
  return `${sign}₦${abs}`;
}
const trim = (n: number) => (Math.round(n * 10) / 10).toString();

/** Accepts "45,000,000", "₦45000000", "45000000.00" → 45000000. Returns null for blanks. */
export function parseNaira(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).replace(/[₦,\s]/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export function km(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${new Intl.NumberFormat("en-NG").format(n)} km`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (m: number) => MONTHS[m - 1] ?? "";
export const monthShort = (m: number) => monthName(m).slice(0, 3);

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00` : d) : d;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Today's date as YYYY-MM-DD in Lagos time. */
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/** Digits only, Nigerian numbers normalised to 234… so 0803… and +234803… match. */
export function phoneKey(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) return `234${d.slice(1)}`;
  return d;
}

/** wa.me link for a phone number in any common format. */
export function whatsappLink(phone: string, text?: string): string {
  const n = phoneKey(phone);
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}
