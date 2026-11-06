import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { admins, users } from "@/db/schema";
import { RevealAction } from "@/components/admin/reveal-action";
import { AdminUserCreate } from "@/components/admin/admin-user-create";
import { ActionForm, ConfirmAction, Field, InlineAction, SubmitButton } from "@/components/form";
import { Badge, Notice, PageHeader, Section, TableWrap } from "@/components/ui";
import { ADMIN_ROLE_LABEL } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { clearDemoData, saveSettings, updateAdminUser } from "@/server/actions/admin-agents";
import { changePassword } from "@/server/actions/auth";
import { can, pageAdmin } from "@/server/auth";
import { demoDataCount } from "@/server/services/demo";
import { getSite, isPlaceholderContact } from "@/server/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const admin = await pageAdmin("settings");
  const owner = can(admin, "users");
  const [site, adminRows, demo] = await Promise.all([
    getSite(),
    owner ? db.select({ u: users, role: admins.role }).from(admins).innerJoin(users, eq(users.id, admins.userId)).orderBy(desc(users.createdAt)) : Promise.resolve([]),
    demoDataCount(),
  ]);

  return (
    <>
      <PageHeader title="Settings" subtitle="Dealership details shown on the public website, staff accounts and housekeeping." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Section title="Dealership details">
            {isPlaceholderContact(site) && <div className="mb-4"><Notice tone="gold">These are placeholder details. Replace them with your real contact information before launch.</Notice></div>}
            <ActionForm action={saveSettings} className="grid gap-4 sm:grid-cols-2">
              <Field label="Dealership name" name="name" required><input id="name" name="name" defaultValue={site.name} className="field" /></Field>
              <Field label="Tagline" name="tagline" required><input id="tagline" name="tagline" defaultValue={site.tagline} className="field" /></Field>
              <Field label="Phone" name="phone" required><input id="phone" name="phone" defaultValue={site.phone} className="field" /></Field>
              <Field label="WhatsApp number" name="whatsapp" required hint="Include the country code, e.g. +234 803 000 0000"><input id="whatsapp" name="whatsapp" defaultValue={site.whatsapp} className="field" /></Field>
              <Field label="Email" name="email" required><input id="email" name="email" type="email" defaultValue={site.email} className="field" /></Field>
              <Field label="Opening hours" name="hours" required><input id="hours" name="hours" defaultValue={site.hours} className="field" /></Field>
              <Field label="Showroom address" name="address" required className="sm:col-span-2"><input id="address" name="address" defaultValue={site.address} className="field" /></Field>
              <Field label="Instagram URL" name="instagram"><input id="instagram" name="instagram" defaultValue={site.instagram} className="field" placeholder="https://instagram.com/…" /></Field>
              <Field label="Facebook URL" name="facebook"><input id="facebook" name="facebook" defaultValue={site.facebook} className="field" placeholder="https://facebook.com/…" /></Field>
              <Field label="X (Twitter) URL" name="x"><input id="x" name="x" defaultValue={site.x} className="field" placeholder="https://x.com/…" /></Field>
              <Field label="TikTok URL" name="tiktok"><input id="tiktok" name="tiktok" defaultValue={site.tiktok} className="field" placeholder="https://tiktok.com/@…" /></Field>
              <Field label="Vehicle feature suggestions" name="featureSuggestions" className="sm:col-span-2" hint="One per line. These appear as quick-pick chips on the vehicle form; you can still add custom features per car.">
                <textarea id="featureSuggestions" name="featureSuggestions" rows={8} defaultValue={site.featureSuggestions.join("\n")} className="field font-mono text-[13px]" />
              </Field>
              <div className="sm:col-span-2"><SubmitButton>Save settings</SubmitButton></div>
            </ActionForm>
          </Section>

          {owner && (
            <Section title="Admin accounts" actions={<AdminUserCreate />}>
              <TableWrap>
                <table className="table-x">
                  <thead><tr><th>Name</th><th>Role</th><th>Last login</th><th /></tr></thead>
                  <tbody>
                    {adminRows.map(({ u, role }) => (
                      <tr key={u.id}>
                        <td><p className="font-medium text-ink">{u.name} {u.id === admin.userId && <Badge>You</Badge>} {u.status === "disabled" && <Badge tone="bad">Disabled</Badge>}</p><p className="text-[12px] text-muted">{u.email}</p></td>
                        <td>
                          {u.id === admin.userId ? ADMIN_ROLE_LABEL[role] : (
                            <ActionForm action={updateAdminUser} className="flex gap-1.5">
                              <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="op" value="role" />
                              <select name="role" defaultValue={role} aria-label="Role" className="field h-9 w-auto py-1 text-[13px]">{Object.entries(ADMIN_ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                              <SubmitButton variant="outline" size="sm">Save</SubmitButton>
                            </ActionForm>
                          )}
                        </td>
                        <td className="text-[12.5px] text-muted">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</td>
                        <td className="text-right">
                          {u.id !== admin.userId && (
                            <div className="flex flex-col items-end gap-1.5">
                              <RevealAction action={updateAdminUser} fields={{ userId: u.id, op: "reset" }} label="Reset password" />
                              {u.status === "active"
                                ? <ConfirmAction action={updateAdminUser} fields={{ userId: u.id, op: "disable" }} label="Disable" variant="ghost" confirmTitle={`Disable ${u.name}?`} confirmBody="They are signed out and can't log in until re-enabled." confirmLabel="Disable account" />
                                : <InlineAction action={updateAdminUser} fields={{ userId: u.id, op: "enable" }}>Enable</InlineAction>}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <p className="mt-3 text-[12px] text-stone"><strong>Owner</strong>: everything. <strong>Manager</strong>: everything except admin accounts. <strong>Sales staff</strong>: inventory, orders, customers and enquiries — no costs, profit, CRM finance or commissions.</p>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Your password">
            <ActionForm action={changePassword} resetOnSuccess className="space-y-3">
              <Field label="Current password" name="current"><input id="current" name="current" type="password" autoComplete="current-password" className="field" /></Field>
              <Field label="New password" name="password" hint="At least 8 characters."><input id="password" name="password" type="password" autoComplete="new-password" className="field" /></Field>
              <Field label="Confirm new password" name="confirm"><input id="confirm" name="confirm" type="password" autoComplete="new-password" className="field" /></Field>
              <SubmitButton>Change password</SubmitButton>
            </ActionForm>
          </Section>

          {owner && (
            <Section title="Demo data">
              {demo > 0 ? (
                <>
                  <p className="text-sm text-muted">The platform contains sample vehicles, sales, expenses and agents (marked <Badge tone="info">Demo</Badge>). Remove them before going live. Records you added yourself are kept.</p>
                  <ActionForm action={clearDemoData} className="mt-4 space-y-3">
                    <Field label="Type REMOVE to confirm" name="confirm"><input id="confirm" name="confirm" className="field" autoComplete="off" /></Field>
                    <SubmitButton variant="danger" pending="Removing…">Remove all demo data</SubmitButton>
                  </ActionForm>
                </>
              ) : <p className="text-sm text-muted">No demo data in the system.</p>}
            </Section>
          )}

          <Section title="Online payments">
            <p className="text-sm text-muted">Online payment is <strong className="text-ink">disabled</strong>. Orders are created with payment status Pending and admins mark them paid manually. The checkout is built so Paystack, Flutterwave or bank transfer can be connected later — see <code className="rounded bg-mist px-1">src/server/payments</code>.</p>
          </Section>
        </div>
      </div>
    </>
  );
}
