import { Suspense } from "react";
import Link from "next/link";
import { and, desc, eq, gte, ilike, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { expenses, vehicles } from "@/db/schema";
import { ExpenseForm } from "@/components/admin/expense-form";
import { PeriodFilter, TableFilters } from "@/components/admin/filters";
import { ConfirmAction } from "@/components/form";
import { Badge, EmptyState, PageHeader, Section, TableWrap } from "@/components/ui";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/constants";
import { formatDate, monthName, naira } from "@/lib/format";
import { deleteExpense } from "@/server/actions/admin-crm";
import { pageAdmin } from "@/server/auth";
import { parsePeriod, periodRange } from "@/server/services/finance";
import { vehicleOptions } from "@/server/services/vehicles";

export const metadata = { title: "Expenses" };
type Cat = keyof typeof EXPENSE_CATEGORY_LABEL;

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await pageAdmin("finance");
  const sp = await searchParams;
  const { year, month } = parsePeriod(sp);
  const { from, to } = periodRange(year, month);
  const w: (SQL | undefined)[] = [gte(expenses.spentOn, from), lt(expenses.spentOn, to)];
  if (sp.category && sp.category in EXPENSE_CATEGORY_LABEL) w.push(eq(expenses.category, sp.category as Cat));
  if (sp.vehicle && /^[0-9a-f-]{36}$/i.test(sp.vehicle)) w.push(eq(expenses.vehicleId, sp.vehicle));
  if (sp.q) w.push(ilike(expenses.title, `%${sp.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`));
  const where = and(...w);
  const [rows, byCat, vehicleList] = await Promise.all([
    db.select({ e: expenses, vehicleTitle: vehicles.title }).from(expenses).leftJoin(vehicles, eq(vehicles.id, expenses.vehicleId)).where(where).orderBy(desc(expenses.spentOn), desc(expenses.createdAt)).limit(500),
    db.select({ category: expenses.category, total: sql<number>`sum(${expenses.amount})::bigint` }).from(expenses).where(where).groupBy(expenses.category),
    vehicleOptions(),
  ]);
  const total = rows.reduce((s, r) => s + r.e.amount, 0);

  return (
    <>
      <PageHeader title="Expenses" subtitle={`${month ? `${monthName(month)} ${year}` : year} · ${naira(total)} across ${rows.length} expense${rows.length === 1 ? "" : "s"}`} actions={<Suspense><PeriodFilter year={year} month={month} /></Suspense>} />
      <Section title="Add expense" className="mb-6"><ExpenseForm initial={{}} vehicles={vehicleList} compact /></Section>

      {byCat.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {byCat.sort((a, b) => Number(b.total) - Number(a.total)).map((c) => (
            <Link key={c.category} href={`/admin/crm/expenses?${new URLSearchParams({ year: String(year), month: month ? String(month) : "all", category: c.category })}`} className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] hover:border-ink/40">
              {EXPENSE_CATEGORY_LABEL[c.category]} <strong className="tabular-nums">{naira(Number(c.total))}</strong>
            </Link>
          ))}
        </div>
      )}
      <Suspense>
        <TableFilters placeholder="Search expense titles…" statusKey="category" statuses={Object.entries(EXPENSE_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
          extra={[{ key: "vehicle", label: "Vehicle", options: vehicleList.map((v) => ({ value: v.id, label: v.title })) }]} />
      </Suspense>
      {rows.length === 0 ? <EmptyState title="No expenses in this period" body="Try another month, or add one above." /> : (
        <TableWrap>
          <table className="table-x">
            <thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Vehicle</th><th className="text-right">Amount</th><th>Receipt</th><th /></tr></thead>
            <tbody>
              {rows.map(({ e, vehicleTitle }) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-muted">{formatDate(e.spentOn)}</td>
                  <td className="max-w-[280px]">
                    {e.payoutId ? <span className="font-medium text-ink">{e.title}</span> : <Link href={`/admin/crm/expenses/${e.id}`} className="font-medium text-ink hover:underline">{e.title}</Link>}
                    {e.description && <p className="truncate text-[12px] text-muted">{e.description}</p>}
                    {e.payoutId && <Badge tone="info" className="mt-1">From payout</Badge>}
                  </td>
                  <td><Badge>{EXPENSE_CATEGORY_LABEL[e.category]}</Badge></td>
                  <td className="max-w-[180px] truncate text-muted">{vehicleTitle ?? "—"}</td>
                  <td className="text-right font-medium tabular-nums">{naira(e.amount)}</td>
                  <td>{e.receiptPath ? <a href={`/api/admin/receipts/${e.id}`} target="_blank" className="text-[12.5px] text-gold underline">View</a> : <span className="text-stone">—</span>}</td>
                  <td className="text-right">{!e.payoutId && <ConfirmAction action={deleteExpense} fields={{ id: e.id }} label="Delete" variant="ghost" confirmTitle={`Delete “${e.title}”?`} confirmBody="This permanently removes the expense and its receipt." confirmLabel="Delete expense" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
