"use server";
import { randomBytes } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { admins, agents, sessions, users } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { hashPassword } from "@/lib/crypto";
import { requireAdmin } from "@/server/auth";
import { DEFAULT_SITE, saveSite, type SiteSettings } from "@/server/settings";
import { removeDemoData } from "@/server/services/demo";
import { formObject, run, UserError, zEmail, zId, zText } from "./util";

export async function setAgentStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("agents");
    const id = zId.parse(fd.get("id"));
    const status = z.enum(["approved", "suspended", "pending"]).parse(fd.get("status"));
    const [a] = await db.update(agents).set({ status, ...(status === "approved" ? { approvedAt: new Date() } : {}) }).where(eq(agents.id, id)).returning();
    if (!a) throw new UserError("Agent not found.");
    return { approved: "Agent approved — their referrals now count.", suspended: "Agent suspended. New referrals won't be credited.", pending: "Agent moved back to pending." }[status];
  });
}

/** Sets a random temporary password and shows it once, so the admin can pass it on. */
export async function resetAgentPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("agents");
    const id = zId.parse(fd.get("id"));
    const [a] = await db.select({ userId: agents.userId }).from(agents).where(eq(agents.id, id)).limit(1);
    if (!a) throw new UserError("Agent not found.");
    const temp = randomBytes(6).toString("base64url");
    await db.update(users).set({ passwordHash: await hashPassword(temp) }).where(eq(users.id, a.userId));
    await db.delete(sessions).where(eq(sessions.userId, a.userId));
    return { ok: true, message: "Temporary password created.", data: { temp } };
  });
}

/* ── settings ─────────────────────────────────────────────────────────── */

const url = z.string().optional().transform((s) => s?.trim() ?? "").refine((s) => !s || /^https?:\/\/\S+$/.test(s), "Use a full link starting with https://");
const settingsSchema = z.object({
  name: zText("Dealership name", 80), tagline: zText("Tagline", 160),
  phone: zText("Phone", 40), whatsapp: zText("WhatsApp number", 40), email: zEmail, address: zText("Address", 300), hours: zText("Opening hours", 120),
  instagram: url, facebook: url, x: url, tiktok: url,
  featureSuggestions: z.string().transform((s) => [...new Set(s.split("\n").map((x) => x.trim()).filter(Boolean))].slice(0, 80)),
});

export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("settings");
    const v = settingsSchema.parse(formObject(fd));
    const value: SiteSettings = { ...DEFAULT_SITE, ...v };
    await saveSite(value);
    return "Settings saved. The public site is updated.";
  });
}

/* ── admin accounts (owner only) ──────────────────────────────────────── */

const adminSchema = z.object({ name: zText("Name", 120), email: zEmail, role: z.enum(["owner", "manager", "sales"]) });

export async function createAdminUser(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("users");
    const v = adminSchema.parse(formObject(fd));
    const [exists] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${v.email}`).limit(1);
    if (exists) return { ok: false, message: "That email already has an account.", errors: { email: "Already in use." } };
    const temp = randomBytes(9).toString("base64url");
    await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ email: v.email, name: v.name, role: "admin", passwordHash: await hashPassword(temp) }).returning();
      await tx.insert(admins).values({ userId: u.id, role: v.role });
    });
    return { ok: true, message: `Admin account created for ${v.email}.`, data: { temp } };
  });
}

export async function updateAdminUser(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const me = await requireAdmin("users");
    const userId = zId.parse(fd.get("userId"));
    const op = z.enum(["role", "disable", "enable", "reset"]).parse(fd.get("op"));
    if (userId === me.userId && op !== "reset") throw new UserError("You can't change your own role or disable yourself.");
    if (op === "role") {
      const role = z.enum(["owner", "manager", "sales"]).parse(fd.get("role"));
      if (role !== "owner") await ensureAnotherOwner(userId);
      await db.update(admins).set({ role }).where(eq(admins.userId, userId));
      return "Role updated.";
    }
    if (op === "disable") {
      await ensureAnotherOwner(userId);
      await db.update(users).set({ status: "disabled" }).where(eq(users.id, userId));
      await db.delete(sessions).where(eq(sessions.userId, userId));
      return "Account disabled and signed out.";
    }
    if (op === "enable") {
      await db.update(users).set({ status: "active" }).where(eq(users.id, userId));
      return "Account enabled.";
    }
    const temp = randomBytes(9).toString("base64url");
    await db.update(users).set({ passwordHash: await hashPassword(temp) }).where(eq(users.id, userId));
    if (userId !== me.userId) await db.delete(sessions).where(eq(sessions.userId, userId));
    return { ok: true, message: "Temporary password created.", data: { temp } };
  });
}

async function ensureAnotherOwner(exceptUserId: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(admins).innerJoin(users, eq(users.id, admins.userId))
    .where(and(eq(admins.role, "owner"), eq(users.status, "active"), ne(admins.userId, exceptUserId)));
  if (n === 0) throw new UserError("There must always be at least one active owner.");
}

export async function clearDemoData(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await requireAdmin("users");
    if (fd.get("confirm") !== "REMOVE") return { ok: false, message: "Type REMOVE to confirm.", errors: { confirm: "Type REMOVE in capitals." } };
    const n = await removeDemoData();
    return `Demo data removed (${n.vehicles} vehicles, ${n.sales} sales, ${n.agents} agents and related records).`;
  });
}
