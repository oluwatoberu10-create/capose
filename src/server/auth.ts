import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { admins, agents, sessions, users } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/crypto";

export const SESSION_COOKIE = "am_session";
const SESSION_DAYS = 14;

export type AdminRole = "owner" | "manager" | "sales";
export type Permission = "inventory" | "orders" | "customers" | "enquiries" | "finance" | "agents" | "settings" | "users";

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  owner: ["inventory", "orders", "customers", "enquiries", "finance", "agents", "settings", "users"],
  manager: ["inventory", "orders", "customers", "enquiries", "finance", "agents", "settings"],
  // Sales staff never see purchase costs, profit, CRM finance or commissions.
  sales: ["inventory", "orders", "customers", "enquiries"],
};

export type Principal =
  | { kind: "admin"; userId: string; name: string; email: string; role: AdminRole; permissions: Permission[] }
  | { kind: "agent"; userId: string; name: string; email: string; agentId: string; agentStatus: "pending" | "approved" | "suspended"; referralCode: string };

export function can(p: Principal | null, perm: Permission): boolean {
  return p?.kind === "admin" && p.permissions.includes(perm);
}

/* ── sessions ─────────────────────────────────────────────────────────── */

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES, sameSite: "lax", path: "/", expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** Resolves the signed-in principal. Roles and statuses come from the database on every request. */
export const getPrincipal = cache(async (): Promise<Principal | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users, adminRole: admins.role, agent: agents })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(admins, eq(admins.userId, users.id))
    .leftJoin(agents, eq(agents.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.user.status !== "active") return null;
  const base = { userId: row.user.id, name: row.user.name, email: row.user.email };
  if (row.user.role === "admin" && row.adminRole) {
    return { kind: "admin", ...base, role: row.adminRole, permissions: ROLE_PERMISSIONS[row.adminRole] };
  }
  if (row.user.role === "agent" && row.agent) {
    return { kind: "agent", ...base, agentId: row.agent.id, agentStatus: row.agent.status, referralCode: row.agent.referralCode };
  }
  return null;
});

export class AuthError extends Error {}

/** For server actions and route handlers: throws unless the caller is an admin with `perm`. */
export async function requireAdmin(perm: Permission): Promise<Extract<Principal, { kind: "admin" }>> {
  const p = await getPrincipal();
  if (!p || p.kind !== "admin") throw new AuthError("Please sign in as an administrator.");
  if (!p.permissions.includes(perm)) throw new AuthError("Your role does not have access to this.");
  return p;
}

/** For admin pages: redirects to login, or to the dashboard when the role lacks the permission. */
export async function pageAdmin(perm?: Permission): Promise<Extract<Principal, { kind: "admin" }>> {
  const p = await getPrincipal();
  if (!p || p.kind !== "admin") redirect("/admin/login");
  if (perm && !p.permissions.includes(perm)) redirect("/admin?denied=1");
  return p;
}

export async function requireAgent(): Promise<Extract<Principal, { kind: "agent" }>> {
  const p = await getPrincipal();
  if (!p || p.kind !== "agent") throw new AuthError("Please sign in as an agent.");
  return p;
}

export async function pageAgent(): Promise<Extract<Principal, { kind: "agent" }>> {
  const p = await getPrincipal();
  if (!p || p.kind !== "agent") redirect("/agents/login");
  return p;
}

/* ── login throttling (per process; enough to slow down guessing) ─────── */

const attempts = new Map<string, { count: number; until: number }>();

export function loginBlocked(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.count >= 5 && a.until > Date.now();
}

export function recordLoginFailure(key: string): void {
  const a = attempts.get(key);
  const fresh = !a || a.until < Date.now();
  attempts.set(key, { count: fresh ? 1 : a.count + 1, until: Date.now() + 15 * 60_000 });
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
