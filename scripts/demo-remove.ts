/** Removes every row flagged as demo data. Real records are untouched. */
import { loadDotEnv } from "./env";

async function main() {
  loadDotEnv();
  const { ensureEnv } = await import("./pg");
  ensureEnv();
  const { getPool } = await import("../src/db");
  const { removeDemoData } = await import("../src/server/services/demo");
  const n = await removeDemoData();
  console.log(`[demo] removed ${n.vehicles} vehicles, ${n.sales} sales, ${n.agents} agents and related demo records.`);
  await getPool().end();
}

main().catch((e) => { console.error("[demo:remove]", e); process.exit(1); });
