import { Suspense } from "react";
import Link from "next/link";
import { FinanceChart } from "@/components/admin/charts";
import { PeriodFilter } from "@/components/admin/filters";
import { LinkButton, PageHeader, Section, StatCard } from "@/components/ui";
import { monthName, naira } from "@/lib/format";
import { pageAdmin } from "@/server/auth";
import { monthlySeries, outstandingBalances, parsePeriod, periodRange, periodSummary } from "@/server/services/finance";

export const metadata = { title: "Financial dashboard" };

export default async function FinanceDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin("finance");
  const { year, month } = parsePeriod(await searchParams);
  const { from, to } = periodRange(year, month);
  const [s, series, bal] = await Promise.all([periodSummary(from, to), monthlySeries(year), outstandingBalances()]);
  const label = month ? `${monthName(month)} ${year}` : `Full year ${year}`;

  const breakdown: [string, number, string?][] = [
    ["Revenue from sales", s.revenue, "Selling price − discounts + additional income"],
    ["− Acquisition cost of cars sold", -s.acquisitionCostOfSales, "From each sale's acquisition cost"],
    ["= Gross profit", s.grossProfit],
    ["− Sale expenses", -s.saleExpenses, "Costs entered on individual sales"],
    ["− Operating expenses", -s.operatingExpenses, "Expenses page, incl. commission payouts"],
    ["= Net profit", s.netProfit],
  ];

  return (
    <>
      <PageHeader title="Financial dashboard" subtitle={label}
        actions={<><Suspense><PeriodFilter year={year} month={month} /></Suspense></>} />
      <div className="mb-6 flex flex-wrap gap-2">
        <LinkButton href="/admin/crm/sales/new" size="sm">+ Record sale</LinkButton>
        <LinkButton href="/admin/crm/acquisitions/new" variant="outline" size="sm">+ Record acquisition</LinkButton>
        <LinkButton href="/admin/crm/expenses" variant="outline" size="sm">+ Add expense</LinkButton>
        <LinkButton href={`/admin/crm/reports?year=${year}${month ? `&month=${month}` : "&month=all"}`} variant="ghost" size="sm">Reports & CSV →</LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue" value={naira(s.revenue)} tone="dark" hint={`${s.carsSold} car${s.carsSold === 1 ? "" : "s"} sold`} />
        <StatCard label="Expenses" value={naira(s.operatingExpenses)} hint="Operating expenses" />
        <StatCard label="Vehicle purchase costs" value={naira(s.vehiclesPurchasedCost)} hint={`${s.vehiclesPurchased} unit(s) bought this period`} />
        <StatCard label="Cash received" value={naira(s.cashReceived)} hint="Customer payments dated in period" />
        <StatCard label="Gross profit" value={naira(s.grossProfit)} tone={s.grossProfit < 0 ? "bad" : undefined} />
        <StatCard label="Net profit" value={naira(s.netProfit)} tone={s.netProfit < 0 ? "bad" : "ok"} />
        <StatCard label="Outstanding customer balances" value={naira(bal.customerOutstanding)} hint={`${bal.salesWithBalance} sale(s) — all time`} tone={bal.customerOutstanding ? "gold" : undefined} />
        <StatCard label="Agent commissions" value={naira(s.commissionsAccrued)} hint={`Liability (all time): ${naira(bal.commissionLiability)}`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Section title={`Monthly performance — ${year}`}><FinanceChart data={series} /></Section>
        <Section title="How net profit is calculated">
          <dl className="space-y-0.5 text-sm">
            {breakdown.map(([k, v, hint]) => (
              <div key={k} className={`flex items-baseline justify-between gap-4 py-2 ${k.startsWith("=") ? "border-t border-line font-semibold text-ink" : ""}`}>
                <dt><span>{k}</span>{hint && <span className="block text-[11.5px] font-normal text-stone">{hint}</span>}</dt>
                <dd className={`tabular-nums ${v < 0 ? "text-muted" : ""} ${k === "= Net profit" ? (v < 0 ? "text-bad" : "text-ok") : ""}`}>{naira(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-lg bg-mist px-3 py-2.5 text-[12px] leading-relaxed text-muted">
            Acquisition costs are counted once — when the car is sold. “Vehicle purchase costs” above shows what was spent buying stock this period, and is not deducted again.
            Don&apos;t enter acquisition costs as expenses too. <Link href="/admin/crm/acquisitions" className="underline">Acquisitions →</Link>
          </p>
        </Section>
      </div>
    </>
  );
}
