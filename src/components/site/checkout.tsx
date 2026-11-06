"use client";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Badge, btn } from "@/components/ui";
import { naira } from "@/lib/format";
import { submitOrder } from "@/server/actions/public";
import { storedRef } from "./ref-tracker";
import { CarPlaceholder } from "./vehicle-card";

type Color = { id: string; name: string; hex: string; stockQuantity: number | null };
type Props = {
  vehicle: { id: string; title: string; year: number; slug: string; cover: string | null; stock: number; colors: Color[] };
  unitPrice: number; initialColorId: string | null;
  providers: { id: string; name: string; description: string; enabled: boolean }[];
};

const PHONE_RE = /^\+?[\d\s()-]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Checkout({ vehicle, unitPrice, initialColorId, providers }: Props) {
  const firstAvailable = vehicle.colors.find((c) => c.stockQuantity === null || c.stockQuantity > 0)?.id ?? null;
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", message: "", quantity: 1,
    colorId: vehicle.colors.some((c) => c.id === initialColorId && c.stockQuantity !== 0) ? initialColorId : firstAvailable,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, action] = useActionState(submitOrder, { ok: false });
  const [ref, setRef] = useState("");
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => setRef(storedRef()), []);
  useEffect(() => {
    if (state.nonce && !state.ok) {
      if (state.errors) setErrors(state.errors);
      setStep(state.errors && Object.keys(state.errors).some((k) => ["name", "phone", "email", "quantity", "colorId"].includes(k)) ? 1 : 2);
    }
  }, [state]);

  const color = vehicle.colors.find((c) => c.id === form.colorId) ?? null;
  const maxQty = Math.max(1, Math.min(10, color?.stockQuantity ?? vehicle.stock));
  const total = unitPrice * form.quantity;
  const set = (k: keyof typeof form, v: string | number | null) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!PHONE_RE.test(form.phone.trim())) e.phone = "Enter a valid phone number.";
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid email address.";
    if (vehicle.colors.length && !form.colorId) e.colorId = "Choose a colour.";
    if (form.quantity < 1 || form.quantity > maxQty) e.quantity = `Choose between 1 and ${maxQty}.`;
    setErrors(e);
    return !Object.values(e).some(Boolean);
  };
  const next = () => {
    if (!validate()) return;
    setStep(2);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const err = (k: string) => errors[k] ? <p className="mt-1.5 text-[12.5px] text-bad">{errors[k]}</p> : null;

  return (
    <div ref={topRef} className="scroll-mt-24 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <ol className="mb-6 flex items-center gap-3 text-sm" aria-label="Progress">
          {["Your details", "Review & submit"].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className={`grid size-7 place-items-center rounded-full text-xs font-semibold ${step > i ? "bg-ink text-white" : "bg-mist text-muted"}`}>{i + 1}</span>
              <span className={step === i + 1 ? "font-medium text-ink" : "text-muted"}>{label}</span>
              {i === 0 && <span className="mx-1 h-px w-8 bg-line" />}
            </li>
          ))}
        </ol>

        {step === 1 ? (
          <div className="card p-5 sm:p-7">
            <h2 className="text-xl font-semibold">Your details</h2>
            <p className="mt-1 text-sm text-muted">No account needed. We&apos;ll use these details to confirm your order.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="label">Full name <span className="text-gold">*</span></label>
                <input id="name" className="field" autoComplete="name" value={form.name} onChange={(e) => set("name", e.target.value)} />{err("name")}
              </div>
              <div>
                <label htmlFor="phone" className="label">Phone number <span className="text-gold">*</span></label>
                <input id="phone" type="tel" className="field" autoComplete="tel" placeholder="0803 000 0000" value={form.phone} onChange={(e) => set("phone", e.target.value)} />{err("phone")}
              </div>
              <div>
                <label htmlFor="email" className="label">Email (optional)</label>
                <input id="email" type="email" className="field" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} />{err("email")}
              </div>
              {vehicle.colors.length > 0 && (
                <div className="sm:col-span-2">
                  <span className="label">Preferred colour <span className="text-gold">*</span></span>
                  <div className="flex flex-wrap gap-2">
                    {vehicle.colors.map((c) => {
                      const out = c.stockQuantity === 0;
                      return (
                        <button key={c.id} type="button" disabled={out} onClick={() => { set("colorId", c.id); set("quantity", 1); }} aria-pressed={form.colorId === c.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${form.colorId === c.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40"}`}>
                          <span className="size-4 rounded-full border border-black/10" style={{ background: c.hex }} />{c.name}{out && " — out of stock"}
                        </button>
                      );
                    })}
                  </div>{err("colorId")}
                </div>
              )}
              <div>
                <label htmlFor="quantity" className="label">Quantity</label>
                <select id="quantity" className="field" value={form.quantity} onChange={(e) => set("quantity", Number(e.target.value))}>
                  {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>{err("quantity")}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="message" className="label">Additional message (optional)</label>
                <textarea id="message" rows={3} className="field" placeholder="Preferred inspection date, trade-in, delivery location…" value={form.message} onChange={(e) => set("message", e.target.value)} />
              </div>
            </div>
            <button type="button" onClick={next} className={btn("primary", "lg", "mt-6 w-full sm:w-auto")}>Continue to review</button>
          </div>
        ) : (
          <form action={action} className="space-y-5">
            {Object.entries({ vehicleId: vehicle.id, colorId: form.colorId ?? "", quantity: String(form.quantity), name: form.name, phone: form.phone, email: form.email, message: form.message, ref }).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <div className="card p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Customer information</h2>
                <button type="button" onClick={() => setStep(1)} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">Edit</button>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">Name</dt><dd className="font-medium text-ink">{form.name}</dd></div>
                <div><dt className="text-muted">Phone</dt><dd className="font-medium text-ink">{form.phone}</dd></div>
                <div><dt className="text-muted">Email</dt><dd className="font-medium text-ink">{form.email || "—"}</dd></div>
                {form.message && <div className="sm:col-span-2"><dt className="text-muted">Message</dt><dd className="text-ink">{form.message}</dd></div>}
              </dl>
            </div>

            <div className="card p-5 sm:p-7">
              <h2 className="text-xl font-semibold">Payment</h2>
              <div className="mt-4 rounded-xl border border-[#ead9b8] bg-gold-soft px-4 py-3.5 text-sm leading-relaxed text-[#6b5326]">
                <strong className="font-semibold">Online payment will be enabled later.</strong> Submitting this form places an order request — nothing is charged.
                Your order will be marked <em>Pending confirmation</em> and our team will contact you to confirm availability and arrange payment.
              </div>
              <div className="mt-4 grid gap-2">
                {providers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 opacity-60" aria-disabled>
                    <div className="flex items-center gap-3">
                      <span className="size-4 rounded-full border-2 border-line" />
                      <div><p className="text-sm font-medium text-ink">{p.name}</p><p className="text-[12px] text-muted">{p.description}</p></div>
                    </div>
                    <Badge>Coming soon</Badge>
                  </div>
                ))}
              </div>
            </div>
            {!state.ok && state.message && <p role="alert" className="rounded-lg bg-[#fdeceb] px-4 py-3 text-sm text-bad">{state.message}</p>}
            <PlaceOrder />
            <p className="text-[12px] text-stone">By submitting you agree to our <a href="/terms" className="underline">terms</a> and <a href="/privacy" className="underline">privacy policy</a>.</p>
          </form>
        )}
      </div>

      {/* Summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden">
          <div className="relative aspect-[16/10] bg-mist">
            {vehicle.cover ? <Image src={vehicle.cover} alt={vehicle.title} fill sizes="(min-width:1024px) 35vw, 100vw" className="object-cover" /> : <CarPlaceholder className="absolute inset-0" />}
          </div>
          <div className="p-5">
            <p className="text-[13px] text-muted">Order summary</p>
            <p className="mt-1 font-display text-lg font-semibold text-ink">{vehicle.title}</p>
            <dl className="mt-4 space-y-2.5 text-sm">
              <Row k="Colour" v={color ? <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full border border-black/10" style={{ background: color.hex }} />{color.name}</span> : "—"} />
              <Row k="Quantity" v={form.quantity} />
              <Row k="Vehicle price" v={naira(unitPrice)} />
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums text-ink">{naira(total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="font-medium text-ink tabular-nums">{v}</dd></div>;
}

function PlaceOrder() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btn("primary", "lg", "w-full")}>
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {pending ? "Submitting…" : "Submit order request"}
    </button>
  );
}
