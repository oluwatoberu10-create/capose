"use client";
import { useState } from "react";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { btn } from "@/components/ui";
import { saveCustomer } from "@/server/actions/admin-orders";

export function CustomerCreate() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn("primary")}>+ Add customer</button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="animate-toast w-full max-w-md rounded-t-2xl bg-white p-6 shadow-lift sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Add customer</h3>
            <ActionForm action={saveCustomer} className="mt-5 space-y-4">
              <Field label="Full name" name="name" required><input id="name" name="name" className="field" autoFocus /></Field>
              <Field label="Phone" name="phone" required><input id="phone" name="phone" type="tel" className="field" /></Field>
              <Field label="Email (optional)" name="email"><input id="email" name="email" type="email" className="field" /></Field>
              <div className="flex justify-end gap-2"><button type="button" className={btn("outline")} onClick={() => setOpen(false)}>Cancel</button><SubmitButton>Add customer</SubmitButton></div>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
