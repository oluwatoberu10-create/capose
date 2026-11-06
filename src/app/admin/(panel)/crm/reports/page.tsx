import { Suspense } from "react";
import Link from "next/link";
import { PeriodFilter } from "@/components/admin/filters";
import { EmptyState, PageHeader, TableWrap, btn } from "@/components/ui";
import { naira } from "@/lib/format";
import { pageAdmin } from "@/server/auth";
import { parsePeriod } from "@/server/services/finance";
import { buildReport, REPORTS, type ReportType } from "@/server/services/reports";

export const metadata = { title: "Financial reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin("finance");
  const sp = await searchParams;
  const { year, month } = parsePeriod(sp, false);
  const type: ReportType = sp.report && sp.report in REPORTS ? (sp.report as ReportType) : "monthly-profit";
  const report = await buildReport(type, year, month);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ year: String(year), month: month ? String(month) : "all", ...extra }).toString();

  return (
    <>
      <PageHeader title="Financial reports" subtitle="Preview any report and export it to CSV (opens in Excel or Google Sheets)." actions={<Suspense><PeriodFilter year={year} month={month} /></Suspense>} />
      <div className="scrollbar-none -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {Object.entries(REPORTS).map(([k, label]) => (
          <Link key={k} href={`/admin/crm/reports?${qs({ report: k })}`} className={`shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-medium ${k === type ? "bg-ink text-white" : "border border-line bg-white text-body hover:border-ink/40"}`}>{label}</Link>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{report.title}</h2>
        <a href={`/api/admin/reports/${type}?${qs({})}`} className={btn("primary", "sm")} download>⬇ Export CSV</a>
      </div>
      {report.rows.length === 0 ? <EmptyState title="Nothing to report for this period" body="Choose another month or year, or record some sales and expenses first." /> : (
        <TableWrap>
          <table className="table-x">
            <thead><tr>{report.headers.map((h, i) => <th key={h} className={report.money.includes(i) || typeof report.rows[0][i] === "number" ? "text-right" : ""}>{h}</th>)}</tr></thead>
            <tbody>
              {report.rows.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci} className={report.money.includes(ci) ? `text-right tabular-nums ${Number(c) < 0 ? "text-bad" : ""}` : typeof c === "number" ? "text-right tabular-nums" : "whitespace-nowrap"}>{report.money.includes(ci) ? naira(Number(c)) : c}</td>)}</tr>
              ))}
              {report.totals && (
                <tr className="bg-mist/70 font-semibold">{report.totals.map((c, ci) => <td key={ci} className={report.money.includes(ci) || typeof c === "number" ? "text-right tabular-nums" : ""}>{report.money.includes(ci) && c !== "" ? naira(Number(c)) : c}</td>)}</tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
