import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { AuthError } from "@/server/auth";
import { OrderError } from "@/server/services/orders";
import { SaleError } from "@/server/services/sales";
import { parseNaira } from "@/lib/format";

export class UserError extends Error {}

/** Runs an action body and turns every expected failure into a form state. */
export async function run(fn: () => Promise<string | ActionState | void>): Promise<ActionState> {
  const nonce = Date.now() + Math.random();
  try {
    const r = await fn();
    if (typeof r === "string") return { ok: true, message: r, nonce };
    if (r && typeof r === "object") return { ...r, nonce };
    return { ok: true, nonce };
  } catch (e) {
    unstable_rethrow(e); // let redirect()/notFound() through
    if (e instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".");
        if (key && !errors[key]) errors[key] = issue.message;
      }
      return { ok: false, message: "Please check the highlighted fields.", errors, nonce };
    }
    if (e instanceof AuthError || e instanceof OrderError || e instanceof SaleError || e instanceof UserError) {
      return { ok: false, message: e.message, nonce };
    }
    console.error("[action]", e);
    return { ok: false, message: "Something went wrong. Please try again.", nonce };
  }
}

/** FormData → plain object; repeated keys become arrays. */
export function formObject(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$ACTION")) continue;
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}

/* ── zod field helpers ────────────────────────────────────────────────── */

const trimmed = z.string().transform((s) => s.trim());
export const zText = (label: string, max = 200) => trimmed.pipe(z.string().min(1, `${label} is required.`).max(max, `${label} is too long.`));
export const zOptText = (max = 2000) => z.string().optional().transform((s) => (s?.trim() ? s.trim().slice(0, max) : null));
export const zId = z.string().uuid("Invalid selection.");
export const zOptId = z.string().optional().transform((s) => (s && s.trim() ? s.trim() : null)).pipe(z.string().uuid().nullable());

export const zMoney = (label: string, opts: { required?: boolean; min?: number } = {}) =>
  z.string().optional().transform((s, ctx) => {
    const n = parseNaira(s ?? "");
    if (n === null) {
      if (opts.required) ctx.addIssue({ code: "custom", message: `${label} is required.` });
      return 0;
    }
    if (Number.isNaN(n) || n < 0) { ctx.addIssue({ code: "custom", message: `${label} must be a positive amount.` }); return 0; }
    if (n > 1e13) { ctx.addIssue({ code: "custom", message: `${label} is too large.` }); return 0; }
    if (opts.min !== undefined && n < opts.min) { ctx.addIssue({ code: "custom", message: `${label} must be at least ₦${opts.min.toLocaleString("en-NG")}.` }); return 0; }
    return n;
  });
export const zOptMoney = z.string().optional().transform((s, ctx) => {
  const n = parseNaira(s ?? "");
  if (n === null) return null;
  if (Number.isNaN(n) || n < 0) { ctx.addIssue({ code: "custom", message: "Must be a positive amount." }); return null; }
  return n;
});
export const zOptInt = (label: string, min = 0, max = 10_000_000) => z.string().optional().transform((s, ctx) => {
  if (!s?.trim()) return null;
  const n = Number(s.replace(/,/g, ""));
  if (!Number.isInteger(n) || n < min || n > max) { ctx.addIssue({ code: "custom", message: `${label} must be a whole number between ${min} and ${max.toLocaleString()}.` }); return null; }
  return n;
});
export const zInt = (label: string, min = 0, max = 100_000) => z.string().transform((s, ctx) => {
  const n = Number(String(s ?? "").replace(/,/g, ""));
  if (!s?.trim() || !Number.isInteger(n) || n < min || n > max) { ctx.addIssue({ code: "custom", message: `${label} must be a whole number between ${min} and ${max.toLocaleString()}.` }); return min; }
  return n;
});
export const zDate = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} is required.`).refine((s) => !Number.isNaN(Date.parse(s)), `${label} is not a valid date.`);
export const zPhone = z.string().transform((s) => s.trim()).pipe(z.string().regex(/^\+?[\d\s()-]{7,20}$/, "Enter a valid phone number."));
export const zOptEmail = z.string().optional().transform((s) => s?.trim().toLowerCase() || null).pipe(z.string().email("Enter a valid email address.").nullable());
export const zEmail = z.string().transform((s) => s.trim().toLowerCase()).pipe(z.string().email("Enter a valid email address."));
export const zBool = z.string().optional().transform((s) => s === "on" || s === "true" || s === "1");
export const zPassword = z.string().min(8, "Use at least 8 characters.").max(200);
export const PAYMENT_METHODS = ["bank_transfer", "cash", "pos", "online", "other"] as const;
