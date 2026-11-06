import type { Metadata } from "next";
import { LinkButton } from "@/components/ui";
import { naira } from "@/lib/format";
import { getPrincipal } from "@/server/auth";

export const metadata: Metadata = { title: "Agent referral program" };
export const dynamic = "force-dynamic";

const STEPS = [
  { n: "01", t: "Register free", b: "Create your agent account in under a minute. We review and approve new agents, usually within a business day." },
  { n: "02", t: "Share your link", b: "Copy your personal referral link — for the whole inventory or any specific car — and share it on WhatsApp, Instagram or anywhere." },
  { n: "03", t: "Your buyer orders", b: "When someone orders through your link we record the referral, even if they come back days later to complete it." },
  { n: "04", t: "Get paid", b: "Once the sale is completed and fully paid, we approve your commission and pay it out. Track every step from your dashboard." },
];

export default async function AgentsPage() {
  const p = await getPrincipal();
  const isAgent = p?.kind === "agent";
  return (
    <>
      <section className="relative overflow-hidden bg-ink pt-28 pb-16 text-white sm:pt-36 sm:pb-24">
        <div className="absolute -top-40 -right-40 size-[520px] rounded-full bg-gold-bright/10 blur-3xl" />
        <div className="container-x relative grid items-end gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="eyebrow !text-gold-bright">Agent referral program</p>
            <h1 className="mt-4 text-4xl leading-[1.05] font-semibold text-white sm:text-6xl">Refer a buyer.<br />Earn 10% of the profit.</h1>
            <p className="mt-5 max-w-xl text-lg text-white/65">Turn your network into income. Every car sold through your referral link earns you a commission of 10% of the dealership&apos;s actual profit on that car.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isAgent ? <LinkButton href="/agents/dashboard" variant="gold" size="lg">Go to your dashboard</LinkButton> : (
                <>
                  <LinkButton href="/agents/register" variant="gold" size="lg">Register as an agent</LinkButton>
                  <LinkButton href="/agents/login" variant="light" size="lg">Agent login</LinkButton>
                </>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-bright">Worked example</p>
            <dl className="mt-4 space-y-2.5 text-sm">
              {[["Car purchase cost", 20_000_000], ["Additional expenses", 500_000], ["Selling price", 23_000_000]].map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-white/60">{k}</dt><dd className="tabular-nums">{naira(v as number)}</dd></div>
              ))}
              <div className="flex justify-between border-t border-white/10 pt-2.5"><dt className="text-white/60">Profit</dt><dd className="tabular-nums">{naira(2_500_000)}</dd></div>
              <div className="flex items-baseline justify-between pt-1"><dt className="font-medium">Your commission (10%)</dt><dd className="font-display text-2xl font-semibold text-gold-bright tabular-nums">{naira(250_000)}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="container-x py-16 sm:py-20">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Four steps from link to payout</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6">
              <p className="font-display text-sm font-semibold text-gold">{s.n}</p>
              <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-mist/70 py-16 sm:py-20">
        <div className="container-x grid gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Commission structure</p>
            <h2 className="mt-2 text-3xl font-semibold">Clear, fair and on the actual profit</h2>
            <div className="mt-6 space-y-4 text-muted">
              <p><strong className="text-ink">Commission = Net profit × 10%.</strong> Net profit is the sale amount minus what the car cost us (purchase price plus recorded expenses such as shipping, customs and repairs) and the costs of the sale itself.</p>
              <p>Because it&apos;s calculated on profit, not the selling price, a car that sells at or below cost earns no commission.</p>
              <p>Commissions are reviewed and approved by our team once the sale is completed and fully paid, then paid to you directly. Your dashboard shows each one as Pending, Approved, Paid or Cancelled.</p>
            </div>
          </div>
          <div>
            <p className="eyebrow">Benefits</p>
            <ul className="mt-6 grid gap-3">
              {["Free to join — no targets, no fees", "A personal link for every car in our inventory", "Referrals stay attributed for 90 days", "Live dashboard: referrals, sales and commission", "Commission on every completed, profitable sale you refer", "A dealership team that closes the sale for you"].map((b) => (
                <li key={b} className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3.5 text-sm text-body"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-gold-soft text-[11px] text-gold">✓</span>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {!isAgent && (
        <section className="container-x py-16 text-center sm:py-20">
          <h2 className="text-3xl font-semibold">Ready to start earning?</h2>
          <p className="mx-auto mt-3 max-w-md text-muted">Registration takes less than a minute. Already registered? Log in to get your link.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkButton href="/agents/register" size="lg">Register as an agent</LinkButton>
            <LinkButton href="/agents/login" variant="outline" size="lg">Agent login</LinkButton>
          </div>
        </section>
      )}
    </>
  );
}
