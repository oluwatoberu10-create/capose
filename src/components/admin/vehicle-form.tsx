"use client";
import { useMemo, useState } from "react";
import { ActionForm, Field, FieldError, MoneyInput, SubmitButton } from "@/components/form";
import { btn } from "@/components/ui";
import {
  AVAILABILITY_LABEL, BODY_TYPES, BRANDS, CATEGORIES, COLORS, CONDITION_LABEL, DRIVE_TYPES, ENGINE_TYPES, FUEL_TYPES, STEERING, TRANSMISSIONS,
} from "@/lib/constants";
import { deriveAvailability } from "@/lib/finance";
import { naira } from "@/lib/format";
import { saveVehicle } from "@/server/actions/admin-vehicles";

type Color = { id: string | null; name: string; hex: string; stockQuantity: number | null; key: string };
type Spec = { label: string; value: string; key: string };

export type VehicleFormValues = {
  id?: string; brand?: string; model?: string; year?: number; title?: string; description?: string; vin?: string | null;
  stockNumber?: string; category?: string; condition?: string; featured?: boolean; published?: boolean;
  price?: number; originalPrice?: number | null; discountPrice?: number | null; purchaseCost?: number; additionalExpenses?: number;
  engineType?: string | null; engineCapacity?: string | null; horsepower?: number | null; transmission?: string | null; driveType?: string | null;
  fuelType?: string | null; mileage?: number | null; exteriorColor?: string | null; interiorColor?: string | null; doors?: number | null;
  seats?: number | null; bodyType?: string | null; steering?: string | null; dimensions?: string | null;
  customSpecs?: { label: string; value: string }[]; stockQuantity?: number; reservedQuantity?: number; soldQuantity?: number;
  availabilityOverride?: boolean; availability?: string;
  colors?: { id: string; name: string; hex: string; stockQuantity: number | null }[]; features?: string[];
};

const k = () => Math.random().toString(36).slice(2);

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="border-b border-line px-4 py-3.5 sm:px-6"><h2 className="text-[15px] font-semibold">{title}</h2>{desc && <p className="mt-0.5 text-[12.5px] text-muted">{desc}</p>}</div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

/** Text input with suggestions — pick from the list or type any custom value. */
function Combo({ name, label, options, defaultValue, placeholder, required }: { name: string; label: string; options: string[]; defaultValue?: string | null; placeholder?: string; required?: boolean }) {
  return (
    <Field label={label} name={name} required={required}>
      <input id={name} name={name} list={`${name}-list`} defaultValue={defaultValue ?? ""} placeholder={placeholder ?? "Select or type…"} className="field" autoComplete="off" />
      <datalist id={`${name}-list`}>{options.map((o) => <option key={o} value={o} />)}</datalist>
    </Field>
  );
}

export function VehicleForm({ initial, canSeeCosts, featureSuggestions, suggestedStockNumber }: { initial: VehicleFormValues; canSeeCosts: boolean; featureSuggestions: string[]; suggestedStockNumber?: string }) {
  const [colors, setColors] = useState<Color[]>(() => (initial.colors ?? []).map((c) => ({ ...c, key: c.id })));
  const [features, setFeatures] = useState<string[]>(initial.features ?? []);
  const [customFeature, setCustomFeature] = useState("");
  const [specs, setSpecs] = useState<Spec[]>(() => (initial.customSpecs ?? []).map((s) => ({ ...s, key: k() })));
  const [price, setPrice] = useState(initial.price ?? 0);
  const [discount, setDiscount] = useState(initial.discountPrice ?? 0);
  const [cost, setCost] = useState(initial.purchaseCost ?? 0);
  const [extra, setExtra] = useState(initial.additionalExpenses ?? 0);
  const [stock, setStock] = useState(initial.stockQuantity ?? 1);
  const [reserved, setReserved] = useState(initial.reservedQuantity ?? 0);
  const [override, setOverride] = useState(initial.availabilityOverride ?? false);

  const colorStockTracked = colors.some((c) => c.stockQuantity !== null);
  const effectiveStock = colorStockTracked ? colors.reduce((s, c) => s + (c.stockQuantity ?? 0), 0) : stock;
  const autoStatus = deriveAvailability(effectiveStock, reserved);
  const effPrice = discount > 0 && discount < price ? discount : price;
  const expected = effPrice - cost - extra;
  const allFeatures = useMemo(() => [...new Set([...featureSuggestions, ...features])], [featureSuggestions, features]);

  const toggleFeature = (f: string) => setFeatures((fs) => (fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]));
  const addCustomFeature = () => {
    const f = customFeature.trim();
    if (f && !features.includes(f)) setFeatures((fs) => [...fs, f]);
    setCustomFeature("");
  };

  return (
    <ActionForm action={saveVehicle} className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <input type="hidden" name="id" value={initial.id ?? ""} />
      <input type="hidden" name="colors" value={JSON.stringify(colors.map(({ key: _k, ...c }) => c))} />
      <input type="hidden" name="features" value={JSON.stringify(features)} />
      <input type="hidden" name="customSpecs" value={JSON.stringify(specs.filter((s) => s.label.trim() || s.value.trim()).map(({ label, value }) => ({ label, value })))} />

      <div className="min-w-0 space-y-6">
        <Card title="Basic information">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Combo name="brand" label="Brand" options={BRANDS} defaultValue={initial.brand} required />
            <Field label="Model" name="model" required><input id="model" name="model" defaultValue={initial.model} className="field" placeholder="e.g. Camry XSE" /></Field>
            <Field label="Model year" name="year" required><input id="year" name="year" inputMode="numeric" defaultValue={initial.year ?? new Date().getFullYear()} className="field" /></Field>
            <Field label="Vehicle title" name="title" hint="Leave blank to use “Year Brand Model”." className="sm:col-span-2 lg:col-span-3"><input id="title" name="title" defaultValue={initial.title} className="field" placeholder="2023 Toyota Camry XSE" /></Field>
            <Field label="Stock number" name="stockNumber" required><input id="stockNumber" name="stockNumber" defaultValue={initial.stockNumber ?? suggestedStockNumber} className="field" /></Field>
            <Field label="VIN (optional)" name="vin"><input id="vin" name="vin" defaultValue={initial.vin ?? ""} className="field uppercase" maxLength={40} /></Field>
            <Combo name="category" label="Category" options={CATEGORIES} defaultValue={initial.category} />
            <Field label="Condition" name="condition" required>
              <select id="condition" name="condition" defaultValue={initial.condition ?? "foreign_used"} className="field">
                {Object.entries(CONDITION_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Description" name="description" className="sm:col-span-2 lg:col-span-3"><textarea id="description" name="description" rows={5} defaultValue={initial.description} className="field" placeholder="Highlights, history, condition notes… Blank lines start a new paragraph." /></Field>
          </div>
        </Card>

        <Card title="Pricing" desc={canSeeCosts ? "Purchase cost, additional expenses and expected profit are never shown publicly." : "Shown publicly in Naira."}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Selling price" name="price" required><MoneyInput name="price" defaultValue={initial.price ?? null} onValue={setPrice} /></Field>
            <Field label="Original price (optional)" name="originalPrice"><MoneyInput name="originalPrice" defaultValue={initial.originalPrice} /></Field>
            <Field label="Discount price (optional)" name="discountPrice" hint="Shown instead of the selling price when lower."><MoneyInput name="discountPrice" defaultValue={initial.discountPrice} onValue={setDiscount} /></Field>
          </div>
          {canSeeCosts ? (
            <div className="mt-5 rounded-xl border border-dashed border-gold/40 bg-gold-soft/40 p-4">
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-gold">Internal · admin only</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Purchase cost (per unit)" name="purchaseCost" hint="Synced automatically from a linked acquisition record."><MoneyInput name="purchaseCost" defaultValue={initial.purchaseCost ?? 0} onValue={setCost} /></Field>
                <Field label="Additional expenses (per unit)" name="additionalExpenses"><MoneyInput name="additionalExpenses" defaultValue={initial.additionalExpenses ?? 0} onValue={setExtra} /></Field>
                <div>
                  <span className="label">Expected profit</span>
                  <p className={`flex h-[46px] items-center rounded-lg border border-line bg-white px-3.5 font-semibold tabular-nums ${expected < 0 ? "text-bad" : "text-ok"}`}>{naira(expected)}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <input type="hidden" name="purchaseCost" value="" /><input type="hidden" name="additionalExpenses" value="" />
            </>
          )}
        </Card>

        <Card title="Specifications" desc="Pick from the list or type your own value.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Combo name="engineType" label="Engine type" options={ENGINE_TYPES} defaultValue={initial.engineType} />
            <Field label="Engine capacity" name="engineCapacity"><input id="engineCapacity" name="engineCapacity" defaultValue={initial.engineCapacity ?? ""} className="field" placeholder="2.5L" /></Field>
            <Field label="Horsepower" name="horsepower"><input id="horsepower" name="horsepower" inputMode="numeric" defaultValue={initial.horsepower ?? ""} className="field" placeholder="203" /></Field>
            <Combo name="transmission" label="Transmission" options={TRANSMISSIONS} defaultValue={initial.transmission} />
            <Combo name="driveType" label="Drive type" options={DRIVE_TYPES} defaultValue={initial.driveType} />
            <Combo name="fuelType" label="Fuel type" options={FUEL_TYPES} defaultValue={initial.fuelType} />
            <Field label="Mileage (km)" name="mileage"><input id="mileage" name="mileage" inputMode="numeric" defaultValue={initial.mileage ?? ""} className="field" placeholder="0 for brand new" /></Field>
            <Combo name="exteriorColor" label="Exterior colour" options={COLORS.map((c) => c.name)} defaultValue={initial.exteriorColor} />
            <Combo name="interiorColor" label="Interior colour" options={["Black", "Beige", "Brown", "Grey", "Red", "White", "Tan"]} defaultValue={initial.interiorColor} />
            <Field label="Doors" name="doors"><input id="doors" name="doors" inputMode="numeric" defaultValue={initial.doors ?? ""} className="field" /></Field>
            <Field label="Seats" name="seats"><input id="seats" name="seats" inputMode="numeric" defaultValue={initial.seats ?? ""} className="field" /></Field>
            <Combo name="bodyType" label="Body type" options={BODY_TYPES} defaultValue={initial.bodyType} />
            <Combo name="steering" label="Steering position" options={STEERING} defaultValue={initial.steering ?? "Left-hand drive"} />
            <Field label="Dimensions (optional)" name="dimensions" className="sm:col-span-2"><input id="dimensions" name="dimensions" defaultValue={initial.dimensions ?? ""} className="field" placeholder="4,885 × 1,840 × 1,445 mm" /></Field>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-medium text-ink">Other specifications</p>
              <button type="button" className={btn("outline", "sm")} onClick={() => setSpecs((s) => [...s, { label: "", value: "", key: k() }])}>+ Add specification</button></div>
            {specs.length === 0 && <p className="text-[13px] text-muted">e.g. “Wheel size: 19-inch”, “Warranty: 12 months”.</p>}
            <div className="space-y-2">
              {specs.map((s, i) => (
                <div key={s.key} className="flex gap-2">
                  <input aria-label="Specification name" className="field flex-1" placeholder="Name" value={s.label} onChange={(e) => setSpecs((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <input aria-label="Specification value" className="field flex-[1.4]" placeholder="Value" value={s.value} onChange={(e) => setSpecs((all) => all.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <button type="button" className={btn("ghost", "md", "px-3")} aria-label="Remove specification" onClick={() => setSpecs((all) => all.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
            <FieldError name="customSpecs" />
          </div>
        </Card>

        <Card title="Features" desc="Tap to toggle. The suggestion list can be edited in Settings.">
          <div className="flex flex-wrap gap-2">
            {allFeatures.map((f) => (
              <button key={f} type="button" onClick={() => toggleFeature(f)} aria-pressed={features.includes(f)}
                className={`rounded-full border px-3 py-1.5 text-[13px] transition ${features.includes(f) ? "border-ink bg-ink text-white" : "border-line bg-white text-body hover:border-ink/40"}`}>
                {features.includes(f) ? "✓ " : ""}{f}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input className="field" placeholder="Add a custom feature…" value={customFeature} onChange={(e) => setCustomFeature(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomFeature(); } }} />
            <button type="button" className={btn("outline", "md")} onClick={addCustomFeature}>Add</button>
          </div>
        </Card>

        <Card title="Colour availability" desc="Customers choose from these when ordering. Leave a colour's stock blank to not track it separately.">
          <div className="space-y-2">
            {colors.map((c, i) => (
              <div key={c.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 sm:flex-nowrap">
                <input type="color" aria-label="Colour swatch" value={c.hex} onChange={(e) => setColors((all) => all.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} className="h-11 w-12 shrink-0 cursor-pointer rounded-md border border-line bg-white p-1" />
                <input aria-label="Colour name" className="field min-w-0 flex-1" placeholder="Colour name" value={c.name} onChange={(e) => setColors((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input aria-label="Stock for this colour" inputMode="numeric" className="field w-28" placeholder="Stock" value={c.stockQuantity ?? ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setColors((all) => all.map((x, j) => (j === i ? { ...x, stockQuantity: v === "" ? null : Number(v) } : x))); }} />
                <div className="flex">
                  <button type="button" disabled={i === 0} className={btn("ghost", "md", "px-2.5")} aria-label="Move up" onClick={() => setColors((all) => { const a = [...all]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return a; })}>↑</button>
                  <button type="button" className={btn("ghost", "md", "px-2.5")} aria-label="Remove colour" onClick={() => setColors((all) => all.filter((_, j) => j !== i))}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {COLORS.filter((p) => !colors.some((c) => c.name.toLowerCase() === p.name.toLowerCase())).map((p) => (
              <button key={p.name} type="button" onClick={() => setColors((all) => [...all, { id: null, name: p.name, hex: p.hex, stockQuantity: null, key: k() }])} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[12.5px] hover:border-ink/40">
                <span className="size-3 rounded-full border border-black/10" style={{ background: p.hex }} />+ {p.name}
              </button>
            ))}
            <button type="button" onClick={() => setColors((all) => [...all, { id: null, name: "", hex: "#888888", stockQuantity: null, key: k() }])} className="rounded-full border border-dashed border-line px-2.5 py-1 text-[12.5px] hover:border-ink/40">+ Custom colour</button>
          </div>
          <FieldError name="colors" />
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Card title="Stock & availability">
          <div className="grid grid-cols-3 gap-3">
            <Field label="In stock" name="stockQuantity"><input id="stockQuantity" name="stockQuantity" inputMode="numeric" value={colorStockTracked ? effectiveStock : stock} readOnly={colorStockTracked} onChange={(e) => setStock(Number(e.target.value.replace(/\D/g, "") || 0))} className="field" /></Field>
            <Field label="Reserved" name="reservedQuantity"><input id="reservedQuantity" name="reservedQuantity" inputMode="numeric" value={reserved} onChange={(e) => setReserved(Number(e.target.value.replace(/\D/g, "") || 0))} className="field" /></Field>
            <Field label="Sold" name="soldQuantity"><input id="soldQuantity" name="soldQuantity" inputMode="numeric" defaultValue={initial.soldQuantity ?? 0} className="field" /></Field>
          </div>
          {colorStockTracked && <p className="mt-2 text-[12px] text-stone">Stock is the total of the colour stock figures.</p>}
          <div className="mt-4 rounded-lg bg-mist px-3.5 py-3 text-sm">Automatic status: <strong className="text-ink">{AVAILABILITY_LABEL[autoStatus]}</strong></div>
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input type="checkbox" name="availabilityOverride" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5 size-4 accent-[#a8823f]" />
            <span>Override availability manually</span>
          </label>
          {override ? (
            <select name="availability" defaultValue={initial.availability ?? autoStatus} className="field mt-3" aria-label="Availability">
              {Object.entries(AVAILABILITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : <input type="hidden" name="availability" value={autoStatus} />}
        </Card>

        <Card title="Visibility">
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="published" defaultChecked={initial.published ?? true} className="mt-0.5 size-4 accent-[#a8823f]" /><span><strong className="font-medium text-ink">Published</strong><br /><span className="text-muted">Visible on the public website.</span></span></label>
          <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" name="featured" defaultChecked={initial.featured ?? false} className="mt-0.5 size-4 accent-[#a8823f]" /><span><strong className="font-medium text-ink">Featured</strong><br /><span className="text-muted">Shown in the homepage featured section.</span></span></label>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-[#f6f5f2]/95 px-4 py-3 backdrop-blur xl:static xl:m-0 xl:border-0 xl:bg-transparent xl:p-0">
          <SubmitButton size="lg" className="w-full" pending="Saving…">{initial.id ? "Save changes" : "Create vehicle"}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
