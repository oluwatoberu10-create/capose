import { toCsv } from "@/lib/format";
import { AuthError, requireAdmin } from "@/server/auth";
import { parsePeriod } from "@/server/services/finance";
import { buildReport, REPORTS, type ReportType } from "@/server/services/reports";

/** CSV download of any financial report (admin finance only). */
export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    await requireAdmin("finance");
  } catch (e) {
    return new Response(e instanceof AuthError ? e.message : "Unauthorised", { status: 401 });
  }
  const { type } = await params;
  if (!(type in REPORTS)) return new Response("Unknown report", { status: 404 });
  const url = new URL(req.url);
  const { year, month } = parsePeriod(Object.fromEntries(url.searchParams), false);
  const r = await buildReport(type as ReportType, year, month);
  const csv = "﻿" + toCsv(r.headers, r.totals ? [...r.rows, r.totals] : r.rows); // BOM so Excel reads ₦/UTF-8 correctly
  const name = `${type}-${year}${month ? `-${String(month).padStart(2, "0")}` : ""}.csv`;
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store" },
  });
}
