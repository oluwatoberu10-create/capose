import "server-only";
import { COMMISSION_STATUS_LABEL, EXPENSE_CATEGORY_LABEL, PAYMENT_METHOD_LABEL, SALE_PAYMENT_LABEL } from "@/lib/constants";
import { monthName } from "@/lib/format";
import { acquisitionsReport, commissionsReport, expensesReport, monthlySeries, outstandingReport, periodRange, salesReport } from "./finance";

/**
 * Every report as headers + rows of plain values, so the on-screen preview and
 * the CSV export are guaranteed to show the same numbers.
 */
export const REPORTS = {
  "monthly-sales": "Monthly sales",
  "monthly-expenses": "Monthly expenses",
  "monthly-profit": "Monthly profit",
  "sales-history": "Vehicle sales history",
  outstanding: "Outstanding payments",
  commissions: "Agent commissions",
  acquisitions: "Vehicle acquisitions",
} as const;
export type ReportType = keyof typeof REPORTS;

export type Report = { title: string; headers: string[]; rows: (string | number)[][]; money: number[]; totals?: (string | number)[] };

const sum = (rows: (string | number)[][], i: number) => rows.reduce((s, r) => s + (Number(r[i]) || 0), 0);

export async function buildReport(type: ReportType, year: number, month: number | null): Promise<Report> {
  const { from, to } = periodRange(year, month);
  const period = month ? `${monthName(month)} ${year}` : `${year}`;

  if (type === "monthly-sales" || type === "monthly-expenses" || type === "monthly-profit") {
    const series = await monthlySeries(year);
    const pts = month ? series.filter((p) => p.month === month) : series;
    if (type === "monthly-sales") {
      const rows = pts.map((p) => [`${monthName(p.month)} ${year}`, p.sold, p.revenue]);
      return { title: `Monthly sales — ${period}`, headers: ["Month", "Cars sold", "Revenue (NGN)"], rows, money: [2], totals: ["Total", sum(rows, 1), sum(rows, 2)] };
    }
    if (type === "monthly-expenses") {
      const exp = await expensesReport(from, to);
      const byMonthCat = new Map<string, number>();
      for (const { e } of exp) {
        const key = `${e.spentOn.slice(5, 7)}|${e.category}`;
        byMonthCat.set(key, (byMonthCat.get(key) ?? 0) + e.amount);
      }
      const rows = [...byMonthCat.entries()].sort().map(([k, v]) => { const [m, c] = k.split("|"); return [`${monthName(Number(m))} ${year}`, EXPENSE_CATEGORY_LABEL[c as keyof typeof EXPENSE_CATEGORY_LABEL], v]; });
      return { title: `Monthly expenses — ${period}`, headers: ["Month", "Category", "Amount (NGN)"], rows, money: [2], totals: ["Total", "", sum(rows, 2)] };
    }
    const rows = pts.map((p) => [`${monthName(p.month)} ${year}`, p.revenue, p.acquisition, p.revenue - p.acquisition, p.saleExpenses, p.expenses, p.profit]);
    return { title: `Monthly profit — ${period}`, headers: ["Month", "Revenue", "Cost of cars sold", "Gross profit", "Sale expenses", "Operating expenses", "Net profit"], rows, money: [1, 2, 3, 4, 5, 6], totals: ["Total", sum(rows, 1), sum(rows, 2), sum(rows, 3), sum(rows, 4), sum(rows, 5), sum(rows, 6)] };
  }
  if (type === "sales-history") {
    const s = await salesReport(from, to);
    const rows = s.map((r) => [r.saleDate, r.vehicleTitle, r.customerName, r.customerPhone, r.sellingPrice, r.discount, r.additionalIncome, r.total, r.acquisitionCost, r.saleExpenses, r.profit, r.received, r.outstanding, SALE_PAYMENT_LABEL[r.paymentStatus], PAYMENT_METHOD_LABEL[r.paymentMethod]]);
    return {
      title: `Vehicle sales history — ${period}`,
      headers: ["Date", "Vehicle", "Customer", "Phone", "Selling price", "Discount", "Additional income", "Sale amount", "Acquisition cost", "Sale expenses", "Net profit", "Received", "Outstanding", "Payment status", "Method"],
      rows, money: [4, 5, 6, 7, 8, 9, 10, 11, 12], totals: ["Total", "", "", "", sum(rows, 4), sum(rows, 5), sum(rows, 6), sum(rows, 7), sum(rows, 8), sum(rows, 9), sum(rows, 10), sum(rows, 11), sum(rows, 12), "", ""],
    };
  }
  if (type === "outstanding") {
    const s = await outstandingReport();
    const rows = s.map((r) => [r.saleDate, r.vehicleTitle, r.customerName, r.customerPhone, r.total, r.received, r.outstanding]);
    return { title: "Outstanding customer payments (all dates)", headers: ["Sale date", "Vehicle", "Customer", "Phone", "Sale amount", "Received", "Outstanding"], rows, money: [4, 5, 6], totals: ["Total", "", "", "", sum(rows, 4), sum(rows, 5), sum(rows, 6)] };
  }
  if (type === "commissions") {
    const c = await commissionsReport(from, to);
    const rows = c.map((r) => [r.saleDate, r.agentName, r.code, r.vehicleTitle, r.customerName, r.c.profitAmount, `${r.c.ratePercent}%`, r.c.amount, COMMISSION_STATUS_LABEL[r.c.status]]);
    return { title: `Agent commissions — ${period}`, headers: ["Sale date", "Agent", "Code", "Vehicle", "Customer", "Net profit", "Rate", "Commission", "Status"], rows, money: [5, 7], totals: ["Total", "", "", "", "", sum(rows, 5), "", sum(rows, 7), ""] };
  }
  const a = await acquisitionsReport(from, to);
  const rows = a.map((r) => [r.purchaseDate, `${r.year} ${r.brand} ${r.model}`, r.stockNumber ?? "", r.seller ?? "", r.units, r.purchasePrice, r.additionalPurchaseExpenses, r.transportCost, r.customsCost, r.repairsCost, r.otherExpenses, r.totalCost]);
  return {
    title: `Vehicle acquisitions — ${period}`,
    headers: ["Purchase date", "Vehicle", "Stock #", "Seller", "Units", "Purchase price", "Additional", "Transport", "Customs", "Repairs", "Other", "Total cost"],
    rows, money: [5, 6, 7, 8, 9, 10, 11], totals: ["Total", "", "", "", sum(rows, 4), sum(rows, 5), sum(rows, 6), sum(rows, 7), sum(rows, 8), sum(rows, 9), sum(rows, 10), sum(rows, 11)],
  };
}
