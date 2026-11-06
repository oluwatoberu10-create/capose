"use server";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { agents, users } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { clearLoginFailures, createSession, destroySession, getPrincipal, loginBlocked, recordLoginFailure } from "@/server/auth";
import { newReferralCode } from "@/server/services/agents";
import { formObject, run, UserError, zEmail, zPassword, zPhone, zText } from "./util";

const loginSchema = z.object({ email: zEmail, password: z.string().min(1, "Enter your password."), next: z.string().optional() });

/** Constant-ish time: always run one scrypt even when the email is unknown. */
const DUMMY_HASH = "scrypt$00000000000000000000000000000000$" + "0".repeat(128);

async function login(fd: FormData, role: "admin" | "agent"): Promise<string> {
  const { email, password, next } = loginSchema.parse(formObject(fd));
  const key = `${role}:${email}`;
  if (loginBlocked(key)) throw new UserError("Too many failed attempts. Try again in 15 minutes.");
  const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  const ok = await verifyPassword(password, u?.passwordHash ?? DUMMY_HASH);
  if (!u || !ok || u.role !== role) {
    recordLoginFailure(key);
    throw new UserError("Incorrect email or password.");
  }
  if (u.status !== "active") throw new UserError("This account has been disabled. Contact the dealership.");
  clearLoginFailures(key);
  await createSession(u.id);
  const fallback = role === "admin" ? "/admin" : "/agents/dashboard";
  const prefix = role === "admin" ? "/admin" : "/agents";
  return next && next.startsWith(prefix) && !next.startsWith("//") ? next : fallback;
}

export async function adminLogin(_: ActionState, fd: FormData): Promise<ActionState> {
  let dest: string | null = null;
  const r = await run(async () => { dest = await login(fd, "admin"); });
  if (dest) redirect(dest);
  return r;
}

export async function agentLogin(_: ActionState, fd: FormData): Promise<ActionState> {
  let dest: string | null = null;
  const r = await run(async () => { dest = await login(fd, "agent"); });
  if (dest) redirect(dest);
  return r;
}

const registerSchema = z.object({
  name: zText("Full name", 120), email: zEmail, phone: zPhone, password: zPassword,
  confirm: z.string(), agree: z.string().optional(),
}).refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] })
  .refine((v) => v.agree === "on", { message: "Please accept the program terms.", path: ["agree"] });

export async function registerAgent(_: ActionState, fd: FormData): Promise<ActionState> {
  let done = false;
  const r = await run(async () => {
    const input = registerSchema.parse(formObject(fd));
    const [exists] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${input.email}`).limit(1);
    if (exists) return { ok: false, message: "An account with this email already exists.", errors: { email: "Already registered — log in instead." } };
    const code = await newReferralCode(input.name);
    const passwordHash = await hashPassword(input.password);
    const userId = await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ email: input.email, name: input.name, phone: input.phone, passwordHash, role: "agent" }).returning();
      await tx.insert(agents).values({ userId: u.id, referralCode: code });
      return u.id;
    });
    await createSession(userId);
    done = true;
  });
  if (done) redirect("/agents/dashboard?welcome=1");
  return r;
}

export async function logout(): Promise<void> {
  const p = await getPrincipal();
  await destroySession();
  redirect(p?.kind === "admin" ? "/admin/login" : "/agents/login");
}

const pwSchema = z.object({ current: z.string().min(1, "Enter your current password."), password: zPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const p = await getPrincipal();
    if (!p) throw new UserError("Please sign in again.");
    const input = pwSchema.parse(formObject(fd));
    const [u] = await db.select().from(users).where(eq(users.id, p.userId)).limit(1);
    if (!u || !(await verifyPassword(input.current, u.passwordHash))) return { ok: false, message: "Current password is incorrect.", errors: { current: "Incorrect password." } };
    await db.update(users).set({ passwordHash: await hashPassword(input.password) }).where(eq(users.id, p.userId));
    return "Password updated.";
  });
}

