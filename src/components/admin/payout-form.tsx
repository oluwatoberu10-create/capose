"use client";
import { useState } from "react";
import { ActionForm, Field, FieldError, SubmitButton } from "@/components/form";
import { PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatDate, naira, todayISO } from "@/lib/format";
import { savePayout } from "@/server/actions/admin-crm";

type C = { id: string; agentId: string; amount: number; vehicle: string; saleDate: string; customer: string };

export function PayoutForm({ agents, commissions, initialAgent }: { agents: { id: string; name: string; code: string }[]; commissions: C[]; initialAgent: string }) {
  const [agentId, setAgentId] = useState(initialAgent);
  const mine = commissions.filter((c) => c.agentId === agentId);
  const [picked, setPicked] = useState<string[]>(mine.map((c) => c.id));
  const total = mine.filter((c) => picked.includes(c.id)).reduce((s, c) => s + c.amount, 0);

  return (
    <ActionForm action={savePayout} className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <Field label="Agent" name="agentId">
          <select id="agentId" name="agentId" value={agentId} className="field" onChange={(e) => { setAgentId(e.target.value); setPicked(commissions.filter((c) => c.agentId === e.target.value).map((c) => c.id)); }}>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
          </select>
        </Field>
        <p className="mt-4 mb-2 text-sm font-medium text-ink">Approved commissions to include</p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {mine.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
                <input type="checkbox" name="commissionIds" value={c.id} checked={picked.includes(c.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))} className="size-4 accent-[#a8823f]" />
                <span className="flex-1"><span className="block font-medium text-ink">{c.vehicle}</span><span className="text-[12px] text-muted">{formatDate(c.saleDate)} · {c.customer}</span></span>
                <span className="font-semibold tabular-nums">{naira(c.amount)}</span>
              </label>
            </li>
          ))}
        </ul>
        <FieldError name="commissionIds" />
      </div>
      <div className="space-y-4">
        <Field label="Date paid" name="paidOn"><input id="paidOn" name="paidOn" type="date" defaultValue={todayISO()} className="field" /></Field>
        <Field label="Method" name="method"><select id="method" name="method" defaultValue="bank_transfer" className="field">{Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Reference (optional)" name="reference"><input id="reference" name="reference" className="field" placeholder="Bank transfer reference" /></Field>
        <Field label="Notes (optional)" name="notes"><input id="notes" name="notes" className="field" /></Field>
        <div className="rounded-xl bg-ink p-4 text-white">
          <p className="text-[12px] text-white/55">Payout total</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{naira(total)}</p>
          <SubmitButton variant="gold" className="mt-3 w-full" disabled={!picked.length} pending="Recording…">Record payout</SubmitButton>
        </div>
        <p className="text-[12px] text-stone">Record the payout after you&apos;ve actually sent the money — this platform doesn&apos;t pay agents automatically.</p>
      </div>
    </ActionForm>
  );
}
