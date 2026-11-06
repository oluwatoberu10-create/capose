"use client";
import Link from "next/link";
import { ActionForm, Field, FieldError, SubmitButton } from "@/components/form";
import { adminLogin, agentLogin, registerAgent } from "@/server/actions/auth";

export function LoginForm({ role, next }: { role: "admin" | "agent"; next?: string }) {
  return (
    <ActionForm action={role === "admin" ? adminLogin : agentLogin} className="space-y-4" toast={false}>
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" name="email" required><input id="email" name="email" type="email" autoComplete="email" className="field" autoFocus /></Field>
      <Field label="Password" name="password" required><input id="password" name="password" type="password" autoComplete="current-password" className="field" /></Field>
      <SubmitButton size="lg" pending="Signing in…" className="w-full">Sign in</SubmitButton>
    </ActionForm>
  );
}

export function RegisterForm() {
  return (
    <ActionForm action={registerAgent} className="grid gap-4 sm:grid-cols-2" toast={false}>
      <Field label="Full name" name="name" required className="sm:col-span-2"><input id="name" name="name" autoComplete="name" className="field" /></Field>
      <Field label="Email" name="email" required><input id="email" name="email" type="email" autoComplete="email" className="field" /></Field>
      <Field label="Phone number" name="phone" required><input id="phone" name="phone" type="tel" autoComplete="tel" className="field" placeholder="0803 000 0000" /></Field>
      <Field label="Password" name="password" required hint="At least 8 characters."><input id="password" name="password" type="password" autoComplete="new-password" className="field" /></Field>
      <Field label="Confirm password" name="confirm" required><input id="confirm" name="confirm" type="password" autoComplete="new-password" className="field" /></Field>
      <div className="sm:col-span-2">
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" name="agree" className="mt-0.5 size-4 accent-[#a8823f]" />
          <span>I agree to the referral program <Link href="/terms" className="text-ink underline" target="_blank">terms</Link>, including that commission is 10% of net profit and is paid after admin approval.</span>
        </label>
        <FieldError name="agree" />
      </div>
      <SubmitButton size="lg" pending="Creating account…" className="w-full sm:col-span-2">Create agent account</SubmitButton>
    </ActionForm>
  );
}
