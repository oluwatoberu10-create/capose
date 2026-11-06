import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { CarLinkBuilder, CopyField } from "@/components/copy-field";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { COMMISSION_TONES, EmptyState, Notice, ORDER_TONES, StatCard, StatusBadge } from "@/components/ui";
import { COMMISSION_STATUS_LABEL, ORDER_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, naira } from "@/lib/format";
import { changePassword, logout } from "@/server/actions/auth";
import { pageAgent } from "@/server/auth";
import { agentReferralHistory, agentStats, recentVisits } from "@/server/services/agents";

export const metadata: Metadata = { title: "Agent dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

async function baseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export default async function AgentDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const agent = await pageAgent();
  const { welcome } = await searchParams;
  // Every query below is scoped to the signed-in agent's own id.
  const [stats, history, visits, cars, base] = await Promise.all([
    agentStats(agent.agentId), agentReferralHistory(agent.agentId), recentVisits(agent.agentId, 8),
    db.select({ slug: vehicles.slug, title: vehicles.title }).from(vehicles).where(and(eq(vehicles.published, true), eq(vehicles.availability, "available"))).orderBy(asc(vehicles.title)),
    baseUrl(),
  ]);
  const approved = agent.agentStatus === "approved";

  return (
    <div className="bg-paper pt-24 pb-20 sm:pt-28">
      <div className="container-x">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Agent dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Hello, {agent.name.split(" ")[0]}</h1>
            <p className="mt-1 text-sm text-muted">Referral code <span className="font-mono font-semibold text-ink">{agent.referralCode}</span></p>
          </div>
          <form action={logout}><button className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">Log out</button></form>
        </div>

        <div className="mt-6 space-y-3">
          {welcome && <Notice tone="info">Welcome aboard! Your account is created.{!approved && " We'll review it shortly — your link becomes active once approved."}</Notice>}
          {agent.agentStatus === "pending" && <Notice tone="warn"><strong>Awaiting approval.</strong> You can copy your link now, but referrals are only credited once the dealership approves your account.</Notice>}
          {agent.agentStatus === "suspended" && <Notice tone="bad"><strong>Your agent account is suspended.</strong> New referrals are not being credited. Contact the dealership for details.</Notice>}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total referrals" value={stats.referrals} hint={`${stats.visits} link visits`} />
          <StatCard label="Successful sales" value={stats.successfulSales} />
          <StatCard label="Commission earned" value={naira(stats.earned)} tone="dark" hint="Pending + approved + paid" />
          <StatCard label="Paid to you" value={naira(stats.paid)} tone="ok" />
          <StatCard label="Pending review" value={naira(stats.pending)} hint="Awaiting completed sale & approval" />
          <StatCard label="Approved, unpaid" value={naira(stats.approved)} hint="Payout on its way" tone="gold" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section className="rounded-2xl bg-ink p-5 text-white sm:p-7">
            <h2 className="text-lg font-semibold text-white">Your referral link</h2>
            <p className="mt-1 text-sm text-white/55">Anyone who orders through this link within 90 days is credited to you.</p>
            <div className="mt-5"><CopyField dark value={`${base}/?ref=${agent.referralCode}`} label="Homepage link" /></div>
            <div className="mt-6 rounded-xl bg-white p-4 text-body">
              <p className="mb-3 text-sm font-medium text-ink">Link to a specific car</p>
              <CarLinkBuilder base={base} code={agent.referralCode} cars={cars} />
            </div>
          </section>
          <section className="card p-5 sm:p-6">
            <h2 className="text-base font-semibold">Recent link visits</h2>
            {visits.length ? (
              <ul className="mt-4 divide-y divide-line text-sm">
                {visits.map((v, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="truncate text-body">{v.vehicleTitle ?? (v.path === "/" ? "Homepage" : v.path)}</span>
                    <span className="shrink-0 text-[12px] text-stone">{formatDateTime(v.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-muted">No visits yet. Share your link to get started.</p>}
          </section>
        </div>

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Referral history</h2>
          {history.length ? (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-line bg-white shadow-card md:block">
                <table className="table-x">
                  <thead><tr><th>Date</th><th>Customer</th><th>Vehicle</th><th>Order status</th><th className="text-right">Commission</th><th>Commission status</th></tr></thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.id}>
                        <td className="text-muted">{formatDate(r.createdAt)}</td>
                        <td className="font-medium text-ink">{r.customerName}</td>
                        <td>{r.vehicleSlug ? <Link href={`/cars/${r.vehicleSlug}`} className="hover:underline">{r.vehicleTitle}</Link> : r.vehicleTitle ?? "—"}</td>
                        <td>{r.saleId ? <StatusBadge value="completed" map={ORDER_TONES} labels={{ completed: "Sold" }} /> : r.orderStatus ? <StatusBadge value={r.orderStatus} map={ORDER_TONES} labels={ORDER_STATUS_LABEL} /> : "—"}</td>
                        <td className="text-right tabular-nums">{r.commissionAmount !== null ? naira(r.commissionAmount) : "—"}</td>
                        <td>{r.commissionStatus ? <StatusBadge value={r.commissionStatus} map={COMMISSION_TONES} labels={COMMISSION_STATUS_LABEL} /> : <span className="text-[12px] text-stone">After sale</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">
                {history.map((r) => (
                  <div key={r.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-medium text-ink">{r.vehicleTitle ?? "—"}</p><p className="text-sm text-muted">{r.customerName} · {formatDate(r.createdAt)}</p></div>
                      {r.commissionStatus ? <StatusBadge value={r.commissionStatus} map={COMMISSION_TONES} labels={COMMISSION_STATUS_LABEL} /> : r.orderStatus && <StatusBadge value={r.orderStatus} map={ORDER_TONES} labels={ORDER_STATUS_LABEL} />}
                    </div>
                    <p className="mt-3 text-sm">Commission: <strong className="tabular-nums">{r.commissionAmount !== null ? naira(r.commissionAmount) : "after sale"}</strong></p>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyState title="No referrals yet" body="When someone orders a car through your link, it appears here with its commission status." />}
        </section>

        <section className="mt-10 max-w-md">
          <details className="card p-5">
            <summary className="cursor-pointer font-medium text-ink">Change password</summary>
            <ActionForm action={changePassword} resetOnSuccess className="mt-4 space-y-3">
              <Field label="Current password" name="current"><input id="current" name="current" type="password" className="field" autoComplete="current-password" /></Field>
              <Field label="New password" name="password"><input id="password" name="password" type="password" className="field" autoComplete="new-password" /></Field>
              <Field label="Confirm new password" name="confirm"><input id="confirm" name="confirm" type="password" className="field" autoComplete="new-password" /></Field>
              <SubmitButton>Update password</SubmitButton>
            </ActionForm>
          </details>
        </section>
      </div>
    </div>
  );
}
