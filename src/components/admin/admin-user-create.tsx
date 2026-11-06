"use client";
import { useState } from "react";
import { CopyField } from "@/components/copy-field";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { btn } from "@/components/ui";
import { ADMIN_ROLE_LABEL } from "@/lib/constants";
import { createAdminUser } from "@/server/actions/admin-agents";

export function AdminUserCreate() {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const close = () => { setOpen(false); setTemp(null); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn("outline", "sm")}>+ Add admin</button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" onClick={close}>
          <div className="animate-toast w-full max-w-md rounded-t-2xl bg-white p-6 shadow-lift sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Add admin account</h3>
            {temp ? (
              <div className="mt-5 space-y-4">
                <CopyField value={temp} label="Temporary password — shown once" />
                <p className="text-sm text-muted">Share it privately. They sign in at /admin/login and can change it in Settings.</p>
                <button type="button" className={btn("primary", "md", "w-full")} onClick={close}>Done</button>
              </div>
            ) : (
              <ActionForm action={createAdminUser} className="mt-5 space-y-4" onSuccess={(s) => setTemp(String(s.data?.temp ?? ""))}>
                <Field label="Full name" name="name" required><input id="name" name="name" className="field" /></Field>
                <Field label="Email" name="email" required><input id="email" name="email" type="email" className="field" /></Field>
                <Field label="Role" name="role"><select id="role" name="role" defaultValue="sales" className="field">{Object.entries(ADMIN_ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                <div className="flex justify-end gap-2"><button type="button" className={btn("outline")} onClick={close}>Cancel</button><SubmitButton>Create account</SubmitButton></div>
              </ActionForm>
            )}
          </div>
        </div>
      )}
    </>
  );
}
