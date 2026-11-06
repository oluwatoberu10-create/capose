"use client";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { submitEnquiry } from "@/server/actions/public";

export function ContactForm({ vehicleId, vehicleTitle, dark }: { vehicleId?: string; vehicleTitle?: string; dark?: boolean }) {
  const f = dark ? "field-dark" : "field";
  return (
    <ActionForm action={submitEnquiry} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="kind" value={vehicleId ? "vehicle_info" : "contact"} />
      {vehicleId && <input type="hidden" name="vehicleId" value={vehicleId} />}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className={dark ? "[&_.label]:text-white/80" : ""}><Field label="Full name" name="name" required><input id="name" name="name" className={f} autoComplete="name" required /></Field></div>
      <div className={dark ? "[&_.label]:text-white/80" : ""}><Field label="Phone number" name="phone"><input id="phone" name="phone" type="tel" className={f} autoComplete="tel" placeholder="0803 000 0000" /></Field></div>
      <div className={`sm:col-span-2 ${dark ? "[&_.label]:text-white/80" : ""}`}><Field label="Email (optional)" name="email"><input id="email" name="email" type="email" className={f} autoComplete="email" /></Field></div>
      <div className={`sm:col-span-2 ${dark ? "[&_.label]:text-white/80" : ""}`}>
        <Field label="Message" name="message" required>
          <textarea id="message" name="message" rows={4} className={f} required defaultValue={vehicleTitle ? `I'd like more information about the ${vehicleTitle}.` : ""} placeholder="Tell us what you're looking for…" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton variant={dark ? "gold" : "primary"} size="lg" pending="Sending…" className="w-full sm:w-auto">Send message</SubmitButton>
      </div>
    </ActionForm>
  );
}
