"use client";
import { useState } from "react";
import { ActionForm, Field, MoneyInput, SubmitButton } from "@/components/form";
import { acquisitionTotal, perUnitCost } from "@/lib/finance";
import { naira, todayISO } from "@/lib/format";
import { saveAcquisition } from "@/server/actions/admin-crm";

type V = { id: string; title: string; stockNumber: string; brand: string; model: string; year: number };
type A = {
  id?: string; vehicleId?: string | null; brand?: string; model?: string; year?: number; stockNumber?: string | null; purchaseDate?: string; units?: number;
  purchasePrice?: number; seller?: string | null; additionalPurchaseExpenses?: number; transportCost?: number; customsCost?: number; repairsCost?: number; otherExpenses?: number; notes?: string | null;
};

export function AcquisitionForm({ initial, vehicles }: { initial: A; vehicles: V[] }) {
  const [vals, setVals] = useState({
    purchasePrice: initial.purchasePrice ?? 0, additionalPurchaseExpenses: initial.additionalPurchaseExpenses ?? 0, transportCost: initial.transportCost ?? 0,
    customsCost: initial.customsCost ?? 0, repairsCost: initial.repairsCost ?? 0, otherExpenses: initial.otherExpenses ?? 0,
  });
  const [units, setUnits] = useState(initial.units ?? 1);
  const [vehicleId, setVehicleId] = useState(initial.vehicleId ?? "");
  const [basics, setBasics] = useState({ brand: initial.brand ?? "", model: initial.model ?? "", year: String(initial.year ?? new Date().getFullYear()), stockNumber: initial.stockNumber ?? "" });
  const total = acquisitionTotal(vals);
  const set = (k: keyof typeof vals) => (n: number) => setVals((v) => ({ ...v, [k]: n }));

  const pickVehicle = (id: string) => {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v) setBasics({ brand: v.brand, model: v.model, year: String(v.year), stockNumber: v.stockNumber });
  };

  return (
    <ActionForm action={saveAcquisition} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="id" value={initial.id ?? ""} />
      <div className="space-y-6">
        <section className="card p-4 sm:p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Vehicle</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Link to listing (optional)" name="vehicleId" className="sm:col-span-2" hint="Linking lets profit and commissions use this cost automatically.">
              <select id="vehicleId" name="vehicleId" value={vehicleId} onChange={(e) => pickVehicle(e.target.value)} className="field">
                <option value="">Not linked</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.title} (#{v.stockNumber})</option>)}
              </select>
            </Field>
            <Field label="Brand" name="brand" required><input id="brand" name="brand" value={basics.brand} onChange={(e) => setBasics({ ...basics, brand: e.target.value })} className="field" /></Field>
            <Field label="Model" name="model" required><input id="model" name="model" value={basics.model} onChange={(e) => setBasics({ ...basics, model: e.target.value })} className="field" /></Field>
            <Field label="Year" name="year" required><input id="year" name="year" inputMode="numeric" value={basics.year} onChange={(e) => setBasics({ ...basics, year: e.target.value })} className="field" /></Field>
            <Field label="Stock number" name="stockNumber"><input id="stockNumber" name="stockNumber" value={basics.stockNumber} onChange={(e) => setBasics({ ...basics, stockNumber: e.target.value })} className="field" /></Field>
            <Field label="Purchase date" name="purchaseDate" required><input id="purchaseDate" name="purchaseDate" type="date" defaultValue={initial.purchaseDate ?? todayISO()} className="field" /></Field>
            <Field label="Seller / source" name="seller"><input id="seller" name="seller" defaultValue={initial.seller ?? ""} className="field" placeholder="e.g. Copart auction, Cotonou dealer" /></Field>
            <Field label="Units bought" name="units" hint="For several identical cars bought together."><input id="units" name="units" inputMode="numeric" value={units} onChange={(e) => setUnits(Number(e.target.value.replace(/\D/g, "")) || 1)} className="field" /></Field>
          </div>
        </section>
        <section className="card p-4 sm:p-6">
          <h2 className="mb-1 text-[15px] font-semibold">Costs</h2>
          <p className="mb-4 text-[12.5px] text-muted">Everything it cost to get the car ready for sale. Do not enter these again on the Expenses page.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Purchase price" name="purchasePrice" required><MoneyInput name="purchasePrice" defaultValue={initial.purchasePrice ?? null} onValue={set("purchasePrice")} /></Field>
            <Field label="Additional purchase expenses" name="additionalPurchaseExpenses"><MoneyInput name="additionalPurchaseExpenses" defaultValue={initial.additionalPurchaseExpenses ?? 0} onValue={set("additionalPurchaseExpenses")} /></Field>
            <Field label="Transportation" name="transportCost"><MoneyInput name="transportCost" defaultValue={initial.transportCost ?? 0} onValue={set("transportCost")} /></Field>
            <Field label="Customs (optional)" name="customsCost"><MoneyInput name="customsCost" defaultValue={initial.customsCost ?? 0} onValue={set("customsCost")} /></Field>
            <Field label="Repairs (optional)" name="repairsCost"><MoneyInput name="repairsCost" defaultValue={initial.repairsCost ?? 0} onValue={set("repairsCost")} /></Field>
            <Field label="Other expenses" name="otherExpenses"><MoneyInput name="otherExpenses" defaultValue={initial.otherExpenses ?? 0} onValue={set("otherExpenses")} /></Field>
            <Field label="Notes" name="notes" className="sm:col-span-2"><textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ""} className="field" /></Field>
          </div>
        </section>
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <section className="rounded-xl bg-ink p-5 text-white">
          <p className="text-[12px] text-white/50">Total acquisition cost</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{naira(total)}</p>
          {units > 1 && <p className="mt-1 text-sm text-white/60">{naira(perUnitCost(total, units))} per unit</p>}
          <p className="mt-3 text-[12px] leading-relaxed text-white/45">= purchase price + all acquisition expenses</p>
          {vehicleId && (
            <label className="mt-4 flex items-start gap-2.5 text-[13px] text-white/75">
              <input type="checkbox" name="syncVehicle" defaultChecked className="mt-0.5 size-4 accent-[#c9a96a]" />
              <span>Update the listing&apos;s internal cost with this record (per unit)</span>
            </label>
          )}
          <SubmitButton variant="gold" size="lg" className="mt-5 w-full">{initial.id ? "Save changes" : "Save acquisition"}</SubmitButton>
        </section>
      </div>
    </ActionForm>
  );
}
