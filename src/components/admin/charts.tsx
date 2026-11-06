"use client";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthShort, naira, nairaCompact } from "@/lib/format";

type Point = { month: number; revenue: number; expenses: number; acquisition: number; saleExpenses?: number; profit: number; sold: number };

const C = { revenue: "#1c1c21", acquisition: "#c9a96a", expenses: "#b9b6ae", profit: "#1f7a4d", sold: "#a8823f" };

function MoneyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-[12.5px] shadow-lift">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center justify-between gap-6"><span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}</span><span className="font-medium tabular-nums text-ink">{naira(p.value)}</span></p>
      ))}
    </div>
  );
}

export function FinanceChart({ data }: { data: Point[] }) {
  const rows = data.map((d) => ({ ...d, name: monthShort(d.month) }));
  const empty = rows.every((r) => !r.revenue && !r.expenses && !r.acquisition);
  if (empty) return <p className="grid h-72 place-items-center text-sm text-muted">No sales or expenses recorded for this year yet.</p>;
  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ebe9e4" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a8a90" }} />
          <YAxis tickFormatter={nairaCompact} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a8a90" }} width={58} />
          <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="revenue" name="Revenue" fill={C.revenue} radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="acquisition" name="Cost of cars sold" fill={C.acquisition} radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expenses" name="Expenses" fill={C.expenses} radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Line dataKey="profit" name="Net profit" stroke={C.profit} strokeWidth={2.2} dot={{ r: 2.5 }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesCountChart({ data }: { data: Point[] }) {
  const rows = data.map((d) => ({ name: monthShort(d.month), sold: d.sold }));
  if (rows.every((r) => !r.sold)) return <p className="grid h-56 place-items-center text-sm text-muted">No vehicle sales recorded for this year yet.</p>;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ebe9e4" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a8a90" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#8a8a90" }} />
          <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} formatter={(v: number) => [v, "Cars sold"]} contentStyle={{ borderRadius: 8, border: "1px solid #e5e3de", fontSize: 12 }} />
          <Bar dataKey="sold" name="Cars sold" fill={C.sold} radius={[3, 3, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
