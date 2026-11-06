"use client";
import { useState } from "react";
import { ActionForm, Field, MoneyInput, SubmitButton } from "@/components/form";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { commissionFor, netVehicleProfit, publicPrice, saleAmount } from "@/lib/finance";
import { naira, todayISO } from "@/lib/format";
import { saveSale } from "@/server/actions/admin-crm";

type VehicleOpt = { id: string; title: string; stockNumber: string; price: number; discountPrice: number | null; purchaseCost: number; additionalExpenses: number };
type ColorOpt = { id: string; vehicleId: string; name: string; stockQuantity: number | null };
type AgentOpt = { id: string; name: string; code: string; status: string };
export type SaleInitial = {
  id?: string; vehicleId?: string | null; vehicleTitle?: string; colorId?: string | null; customerName?: string; customerPhone?: string; customerEmail?: string | null;
  orderId?: string | null; agentId?: string | null; saleDate?: string; sellingPrice?: number; discount?: number; additionalIncome?: number;
  acquisitionCost?: number; saleExpenses?: number; paymentMethod?: string; notes?: string | null;
};

export function SaleForm({ initial, vehicles, colors, agents, orderRef, locked }: {
  initial: SaleInitial; vehicles: VehicleOpt[]; colors: ColorOpt[]; agents: AgentOpt[]; orderRef?: string | null; locked?: string | null;
}) {
  const editing = !!initial.id;
  const [vehicleId, setVehicleId] = useState(initial.vehicleId ?? "");
  const [colorId, setColorId] = useState(initial.colorId ?? "");
  const [agentId, setAgentId] = useState(initial.agentId ?? "");
  const [f, setF] = useState({
    sellingPrice: initial.sellingPrice ?? 0, discount: initial.discount ?? 0, additionalIncome: initial.additionalIncome ?? 0,
    acquisitionCost: initial.acquisitionCost ?? 0, saleExpenses: initial.saleExpenses ?? 0,
  });
  const [received, setReceived] = useState(0);
  const set = (k: keyof typeof f) => (n: number) => setF((x) => ({ ...x, [k]: n }));

  const pickVehicle = (id: string) => {
    setVehicleId(id);
    setColorId("");
    const v = vehicles.find((x) => x.id === id);
    if (v && !editing) {
      // MoneyInput follows defaultValue changes, so the prefilled figures show up immediately.
      setF((x) => ({ ...x, sellingPrice: publicPrice(v).price, acquisitionCost: v.purchaseCost + v.additionalExpenses }));
    }
  };

  const vColors = colors.filter((c) => c.vehicleId === vehicleId);
  const total = saleAmount(f);
  const profit = netVehicleProfit(f);
  const commission = agentId ? commissionFor(profit) : 0;

  return (
    <ActionForm action={saveSale} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="id" value={initial.id ?? ""} />
      <input type="hidden" name="orderId" value={initial.orderId ?? ""} />
      <div className="space-y-6">
        <section className="card p-4 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Vehicle{orderRef && <span className="ml-2 text-[12.5px] font-normal text-muted">from order {orderRef}</span>}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vehicle" name="vehicleId" required className="sm:col-span-2">
              <select id="vehicleId" name="vehicleId" value={vehicleId} onChange={(e) => pickVehicle(e.target.value)} className="field">
                <option value="">Not in inventory (describe below)</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.title} (#{v.stockNumber})</option>)}
              </select>
            </Field>
            {!vehicleId && <Field label="Vehicle description" name="vehicleTitle" className="sm:col-span-2"><input id="vehicleTitle" name="vehicleTitle" defaultValue={initial.vehicleTitle ?? ""} className="field" placeholder="2019 Lexus RX 350, white" /></Field>}
            {vColors.length > 0 && (
              <Field label="Colour sold" name="colorId">
                <select id="colorId" name="colorId" value={colorId} onChange={(e) => setColorId(e.target.value)} className="field">
                  <option value="">Not specified</option>
                  {vColors.map((c) => <option key={c.id} value={c.id}>{c.name}{c.stockQuantity !== null ? ` (${c.stockQuantity} in stock)` : ""}</option>)}
                </select>
              </Field>
            )}
            {!editing && vehicleId && (
              <label className="flex items-start gap-2.5 self-end pb-2.5 text-sm">
                <input type="checkbox" name="deductStock" defaultChecked className="mt-0.5 size-4 accent-[#a8823f]" />
                <span>Take one unit out of stock</span>
              </label>
            )}
          </div>
        </section>

        <section className="card p-4 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Customer</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Customer name" name="customerName" required><input id="customerName" name="customerName" defaultValue={initial.customerName ?? ""} className="field" /></Field>
            <Field label="Phone" name="customerPhone" required><input id="customerPhone" name="customerPhone" type="tel" defaultValue={initial.customerPhone ?? ""} className="field" /></Field>
            <Field label="Email (optional)" name="customerEmail"><input id="customerEmail" name="customerEmail" type="email" defaultValue={initial.customerEmail ?? ""} className="field" /></Field>
          </div>
          <p className="mt-2 text-[12px] text-stone">Matched to an existing CRM customer by phone number, or added as new.</p>
        </section>

        <section className="card p-4 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Sale figures</h2>
          {locked && <p className="mb-4 rounded-lg bg-[#fdf6ea] px-3 py-2 text-[12.5px] text-[#7a4a00]">{locked}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sale date" name="saleDate" required><input id="saleDate" name="saleDate" type="date" defaultValue={initial.saleDate ?? todayISO()} className="field" /></Field>
            <Field label="Selling price" name="sellingPrice" required><MoneyInput name="sellingPrice" defaultValue={f.sellingPrice || null} onValue={set("sellingPrice")} /></Field>
            <Field label="Discount (optional)" name="discount"><MoneyInput name="discount" defaultValue={f.discount} onValue={set("discount")} /></Field>
            <Field label="Additional income (optional)" name="additionalIncome" hint="e.g. registration or delivery charged to the buyer."><MoneyInput name="additionalIncome" defaultValue={f.additionalIncome} onValue={set("additionalIncome")} /></Field>
            <Field label="Acquisition cost of this unit" name="acquisitionCost" hint="Pre-filled from the listing's acquisition record."><MoneyInput name="acquisitionCost" defaultValue={f.acquisitionCost} onValue={set("acquisitionCost")} /></Field>
            <Field label="Sale expenses" name="saleExpenses" hint="Costs of this sale only — don't also add them as expenses."><MoneyInput name="saleExpenses" defaultValue={f.saleExpenses} onValue={set("saleExpenses")} /></Field>
            <Field label="Payment method" name="paymentMethod">
              <select id="paymentMethod" name="paymentMethod" defaultValue={initial.paymentMethod ?? "bank_transfer"} className="field">{Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </Field>
            {!editing && <Field label="Amount received now" name="amountReceived" hint="Leave 0 if unpaid. Partial payments are fine — add more later."><MoneyInput name="amountReceived" defaultValue={0} onValue={setReceived} /></Field>}
            <Field label="Referral agent" name="agentId" className="sm:col-span-2">
              <select id="agentId" name="agentId" value={agentId} onChange={(e) => setAgentId(e.target.value)} className="field">
                <option value="">No agent</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code}){a.status !== "approved" ? ` — ${a.status}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Notes" name="notes" className="sm:col-span-2"><textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ""} className="field" /></Field>
          </div>
        </section>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-xl bg-ink p-5 text-white">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-white/55">Sale amount</dt><dd className="font-semibold tabular-nums">{naira(total)}</dd></div>
            <div className="flex justify-between"><dt className="text-white/55">− Acquisition cost</dt><dd className="tabular-nums">{naira(f.acquisitionCost)}</dd></div>
            <div className="flex justify-between"><dt className="text-white/55">− Sale expenses</dt><dd className="tabular-nums">{naira(f.saleExpenses)}</dd></div>
            <div className="flex items-baseline justify-between border-t border-white/10 pt-2.5"><dt>Net vehicle profit</dt><dd className={`font-display text-2xl font-semibold tabular-nums ${profit < 0 ? "text-[#ff8a80]" : "text-gold-bright"}`}>{naira(profit)}</dd></div>
            {agentId && <div className="flex justify-between"><dt className="text-white/55">Agent commission (10%)</dt><dd className="tabular-nums">{commission ? naira(commission) : "None — no profit"}</dd></div>}
            {!editing && <div className="flex justify-between"><dt className="text-white/55">Outstanding after this</dt><dd className="tabular-nums">{naira(Math.max(0, total - received))}</dd></div>}
          </dl>
          {f.acquisitionCost === 0 && <p className="mt-3 rounded-md bg-white/10 px-3 py-2 text-[12px] text-white/70">No acquisition cost entered — profit will be overstated and the commission can&apos;t be approved until it&apos;s added.</p>}
          <SubmitButton variant="gold" size="lg" className="mt-5 w-full">{editing ? "Save changes" : "Record sale"}</SubmitButton>
        </section>
      </div>
    </ActionForm>
  );
}
