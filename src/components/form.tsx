"use client";
import { createContext, Fragment, startTransition, useActionState, useContext, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { btn } from "./ui";
import { useToast } from "./toast";

const ErrCtx = createContext<Record<string, string>>({});
const PendingCtx = createContext(false);

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Form bound to a server action. Shows a toast for the result, field errors
 * inline, and optionally resets or navigates on success.
 */
export function ActionForm({
  action, children, className, resetOnSuccess, onSuccessHref, toast = true, onSuccess, id,
}: {
  action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean;
  onSuccessHref?: string; toast?: boolean; onSuccess?: (s: ActionState) => void; id?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, { ok: false });
  const ref = useRef<HTMLFormElement>(null);
  const push = useToast();
  const router = useRouter();
  const seen = useRef<number | undefined>(undefined);
  // Bumped to remount the fields after a successful submit (also clears client-side state like MoneyInput).
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!state.nonce || state.nonce === seen.current) return;
    seen.current = state.nonce;
    if (state.message && toast) push(state.message, state.ok ? "ok" : "error");
    if (state.ok) {
      if (resetOnSuccess) { ref.current?.reset(); setGeneration((g) => g + 1); }
      onSuccess?.(state);
      if (onSuccessHref) router.push(onSuccessHref);
      else router.refresh();
    } else if (state.errors) {
      // Bring the first invalid field into view on long forms.
      const first = Object.keys(state.errors)[0];
      const el = ref.current?.querySelector<HTMLElement>(`#${CSS.escape(first)}`)
        ?? ref.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"]:not([type=hidden])`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [state, push, resetOnSuccess, onSuccessHref, router, toast, onSuccess]);

  return (
    <ErrCtx.Provider value={state.ok ? {} : state.errors ?? {}}>
      <PendingCtx.Provider value={isPending}>
        {/* Submitting through a transition (not the form `action` prop) stops React
            from clearing every field when the server returns a validation error. */}
        <form id={id} ref={ref} className={className} noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (isPending) return;
            const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
            startTransition(() => formAction(fd));
          }}>
          <Fragment key={generation}>{children}</Fragment>
          {!state.ok && state.message && !toast && <p role="alert" className="mt-3 text-sm text-bad">{state.message}</p>}
        </form>
      </PendingCtx.Provider>
    </ErrCtx.Provider>
  );
}

export function FieldError({ name }: { name: string }) {
  const errors = useContext(ErrCtx);
  return errors[name] ? <p className="mt-1.5 text-[12.5px] text-bad">{errors[name]}</p> : null;
}

export function Field({ label, name, hint, children, className = "", required }: { label: string; name: string; hint?: React.ReactNode; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">{label}{required && <span className="text-gold"> *</span>}</label>
      {children}
      {hint && <p className="mt-1.5 text-[12px] text-stone">{hint}</p>}
      <FieldError name={name} />
    </div>
  );
}

export function SubmitButton({ children, pending: pendingLabel, variant = "primary", size = "md", className = "", name, value, disabled }: {
  children: React.ReactNode; pending?: string; variant?: Parameters<typeof btn>[0]; size?: Parameters<typeof btn>[1]; className?: string; name?: string; value?: string; disabled?: boolean;
}) {
  const status = useFormStatus();
  const pending = useContext(PendingCtx) || status.pending;
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} aria-busy={pending} className={btn(variant, size, className)}>
      {pending && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {pending ? pendingLabel ?? "Saving…" : children}
    </button>
  );
}

/** A button that asks for confirmation before running a destructive server action. */
export function ConfirmAction({
  action, fields, label, confirmTitle, confirmBody, confirmLabel = "Delete", variant = "outline", size = "sm", tone = "danger", className = "",
}: {
  action: Action; fields: Record<string, string>; label: React.ReactNode; confirmTitle: string; confirmBody?: string;
  confirmLabel?: string; variant?: Parameters<typeof btn>[0]; size?: Parameters<typeof btn>[1]; tone?: "danger" | "primary"; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={btn(variant, size, className)} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="animate-toast w-full max-w-md rounded-2xl bg-white p-6 shadow-lift" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{confirmTitle}</h3>
            {confirmBody && <p className="mt-2 text-sm leading-relaxed text-muted">{confirmBody}</p>}
            <ActionForm action={action} className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end" onSuccess={() => setOpen(false)}>
              {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <button type="button" className={btn("outline")} onClick={() => setOpen(false)}>Cancel</button>
              <SubmitButton variant={tone === "danger" ? "danger" : "primary"} pending="Working…">{confirmLabel}</SubmitButton>
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}

/** One-click action button (no confirmation), e.g. "Approve". */
export function InlineAction({ action, fields, children, variant = "outline", size = "sm", pending, className, onDone }: {
  action: Action; fields: Record<string, string>; children: React.ReactNode; variant?: Parameters<typeof btn>[0]; size?: Parameters<typeof btn>[1]; pending?: string; className?: string; onDone?: () => void;
}) {
  return (
    <ActionForm action={action} className={`inline-block ${className ?? ""}`} onSuccess={onDone}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton variant={variant} size={size} pending={pending ?? "…"}>{children}</SubmitButton>
    </ActionForm>
  );
}

/** Text input that shows Naira grouping as you type but submits plain digits. */
export function MoneyInput({ name, defaultValue, placeholder, required, id, onValue, dark }: { name: string; defaultValue?: number | null; placeholder?: string; required?: boolean; id?: string; onValue?: (n: number) => void; dark?: boolean }) {
  const fmt = (n: string) => (n ? Number(n).toLocaleString("en-NG") : "");
  const [raw, setRaw] = useState(defaultValue !== null && defaultValue !== undefined ? String(defaultValue) : "");
  useEffect(() => {
    setRaw(defaultValue !== null && defaultValue !== undefined ? String(defaultValue) : "");
  }, [defaultValue]);
  return (
    <div className="relative">
      <span className={`pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm ${dark ? "text-white/50" : "text-stone"}`}>₦</span>
      <input
        id={id ?? name} inputMode="numeric" autoComplete="off" required={required} placeholder={placeholder ?? "0"}
        className={`${dark ? "field-dark" : "field"} pl-8 tabular-nums`} value={fmt(raw)}
        onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 13); setRaw(d); onValue?.(Number(d || 0)); }}
      />
      <input type="hidden" name={name} value={raw} />
    </div>
  );
}
