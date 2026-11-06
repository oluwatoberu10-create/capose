"use client";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { CopyField } from "@/components/copy-field";
import type { ActionState } from "@/lib/action-state";

/** Runs an action that returns a one-time secret (temporary password) and shows it once. */
export function RevealAction({ action, fields, label, note }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; fields: Record<string, string>; label: string; note?: string }) {
  const [temp, setTemp] = useState<string | null>(null);
  return (
    <div>
      <ActionForm action={action} onSuccess={(s) => setTemp(String(s.data?.temp ?? ""))}>
        {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <SubmitButton variant="outline" size="sm" pending="Generating…">{label}</SubmitButton>
      </ActionForm>
      {temp && (
        <div className="mt-3 rounded-lg border border-[#ead9b8] bg-gold-soft/60 p-3">
          <CopyField value={temp} label="Temporary password — shown once" />
          <p className="mt-2 text-[12px] text-muted">{note ?? "Share it privately. They can change it after signing in."}</p>
        </div>
      )}
    </div>
  );
}
