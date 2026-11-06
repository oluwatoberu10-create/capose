/**
 * Creates (or resets the password of) an administrator.
 *
 *   npm run admin:create -- owner@yourdealership.com "Full Name" [owner|manager|sales]
 *
 * The password is read from ADMIN_PASSWORD, or generated and printed once.
 */
import { randomBytes } from "node:crypto";
import { loadDotEnv } from "./env";

async function main() {
  loadDotEnv();
  const { ensureEnv } = await import("./pg");
  ensureEnv();
  const [email, name = "Administrator", role = "owner"] = process.argv.slice(2);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('usage: npm run admin:create -- <email> "<name>" [owner|manager|sales]');
    process.exit(1);
  }
  if (!["owner", "manager", "sales"].includes(role)) throw new Error("role must be owner, manager or sales");
  const password = process.env.ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  if (password.length < 8) throw new Error("ADMIN_PASSWORD must be at least 8 characters");

  const { db, getPool } = await import("../src/db");
  const { admins, users } = await import("../src/db/schema");
  const { hashPassword } = await import("../src/lib/crypto");
  const { sql, eq } = await import("drizzle-orm");
  const hash = await hashPassword(password);
  const lower = email.toLowerCase();

  const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${lower}`).limit(1);
  if (existing && existing.role !== "admin") throw new Error("That email belongs to an agent account.");
  if (existing) {
    await db.update(users).set({ passwordHash: hash, name, status: "active" }).where(eq(users.id, existing.id));
    await db.insert(admins).values({ userId: existing.id, role: role as "owner" }).onConflictDoUpdate({ target: admins.userId, set: { role: role as "owner" } });
    console.log(`[admin] updated ${lower} (${role})`);
  } else {
    const [u] = await db.insert(users).values({ email: lower, name, passwordHash: hash, role: "admin" }).returning();
    await db.insert(admins).values({ userId: u.id, role: role as "owner" });
    console.log(`[admin] created ${lower} (${role})`);
  }
  if (!process.env.ADMIN_PASSWORD) console.log(`[admin] password: ${password}  ← shown once, store it safely`);
  await getPool().end();
}

main().catch((e) => { console.error("[admin:create]", e instanceof Error ? e.message : e); process.exit(1); });
