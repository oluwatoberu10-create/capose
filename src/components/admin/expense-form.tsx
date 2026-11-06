"use client";
import { useState } from "react";
import { ActionForm, Field, MoneyInput, SubmitButton } from "@/components/form";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import { saveExpense } from "@/server/actions/admin-crm";

type E = { id?: string; title?: string; category?: string; amount?: number; spentOn?: string; description?: string | null; vehicleId?: string | null; receiptName?: string | null };

const ACQ_CATEGORIES = ["vehicle_purchase", "transportation", "customs", "repairs"];

export function ExpenseForm({ initial, vehicles, compact }: { initial: E; vehicles: { id: string; title: string; stockNumber: string }[]; compact?: boolean }) {
  const [category, setCategory] = useState(initial.category ?? "");
  return (
    <ActionForm action={saveExpense} resetOnSuccess={!initial.id} className={`grid gap-4 ${compact ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
      <input type="hidden" name="id" value={initial.id ?? ""} />
      <Field label="Expense title" name="title" required><input id="title" name="title" defaultValue={initial.title} className="field" placeholder="e.g. Instagram ads — November" /></Field>
      <Field label="Category" name="category" required>
        <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="field">
          <option value="" disabled>Choose…</option>
          {Object.entries(EXPENSE_CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Amount" name="amount" required><MoneyInput name="amount" defaultValue={initial.amount ?? null} /></Field>
      <Field label="Date" name="spentOn" required><input id="spentOn" name="spentOn" type="date" defaultValue={initial.spentOn ?? todayISO()} className="field" /></Field>
      <Field label="Related vehicle (optional)" name="vehicleId">
        <select id="vehicleId" name="vehicleId" defaultValue={initial.vehicleId ?? ""} className="field">
          <option value="">None</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.title} (#{v.stockNumber})</option>)}
        </select>
      </Field>
      <Field label="Receipt (optional)" name="receipt" hint={initial.receiptName ? `Current: ${initial.receiptName}. Uploading replaces it.` : "PDF, JPG, PNG or WebP, up to 4 MB. Only admins can open it."}>
        <input id="receipt" name="receipt" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="field py-2 file:mr-3 file:rounded-md file:border-0 file:bg-mist file:px-3 file:py-1 file:text-[13px]" />
        {initial.receiptName && <label className="mt-2 flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" name="removeReceipt" className="size-4" /> Remove current receipt</label>}
      </Field>
      <Field label="Description" name="description" className={compact ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-2"}><textarea id="description" name="description" rows={2} defaultValue={initial.description ?? ""} className="field" /></Field>
      {ACQ_CATEGORIES.includes(category) && (
        <p className={`rounded-lg bg-[#fdf6ea] px-3 py-2 text-[12.5px] text-[#7a4a00] ${compact ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-2"}`}>
          Costs that are part of buying a car (purchase price, shipping, customs, pre-sale repairs) belong on its <strong>acquisition record</strong>, where they reduce that car&apos;s profit. Only enter them here if they are <em>not</em> already on an acquisition record, or they will be counted twice.
        </p>
      )}
      <div className={compact ? "sm:col-span-2 lg:col-span-3" : "sm:col-span-2"}><SubmitButton>{initial.id ? "Save changes" : "Add expense"}</SubmitButton></div>
    </ActionForm>
  );
}
