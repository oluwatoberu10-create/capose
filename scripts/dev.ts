/**
 * `npm run dev` (or `npm run preview` for a production build) — starts the
 * local Postgres cluster (creating it on first run), applies migrations, then
 * hands over to Next.js. If DATABASE_URL points elsewhere the local cluster is
 * left alone.
 */
import { spawn, spawnSync } from "node:child_process";
import { loadDotEnv } from "./env";
import { start, isRunning, ensureDatabase, LOCAL_DATABASE_URL } from "./pg";

async function main() {
  loadDotEnv();
  const usingLocal = !process.env.DATABASE_URL || process.env.DATABASE_URL === LOCAL_DATABASE_URL;
  if (usingLocal) {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    if (!isRunning()) start();
    else console.log("[pg] already running");
    await ensureDatabase();
  } else {
    console.log("[db] using DATABASE_URL from the environment");
  }

  const { runMigrations, closePool } = await import("../src/db/migrate");
  await runMigrations();
  await closePool();
  console.log("[db] migrations up to date");

  const bin = process.platform === "win32" ? "node_modules\\.bin\\next.cmd" : "node_modules/.bin/next";
  const opts = { stdio: "inherit" as const, env: process.env, shell: process.platform === "win32" };
  const prod = process.argv.includes("--prod");
  const args = process.argv.slice(2).filter((a) => a !== "--prod");
  if (prod) {
    const build = spawnSync(bin, ["build"], opts);
    if (build.status !== 0) process.exit(build.status ?? 1);
  }
  const next = spawn(bin, [prod ? "start" : "dev", ...args], opts);
  next.on("exit", (code) => process.exit(code ?? 0));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => next.kill(signal));
}

main().catch((err) => {
  console.error("[dev]", err);
  process.exit(1);
});
