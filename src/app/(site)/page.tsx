import Image from "next/image";
import Link from "next/link";
import { LinkButton, btn } from "@/components/ui";
import { VehicleGrid } from "@/components/site/vehicle-card";
import { ContactForm } from "@/components/site/contact-form";
import { featuredVehicles, inventoryFacets, latestAvailable } from "@/server/services/vehicles";
import { getSite } from "@/server/settings";
import { whatsappLink } from "@/lib/format";

export const dynamic = "force-dynamic";

const WHY = [
  { title: "Quality vehicles", body: "Every car is inspected before it is listed. Foreign used units come with verifiable history and clean customs papers.", icon: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Zm-3 9 2 2 4-4" },
  { title: "Transparent pricing", body: "The price you see is the price in Naira. No hidden charges, no surprises at the point of payment.", icon: "M4 7h16M4 12h16M4 17h10" },
  { title: "Trusted dealership", body: "Clear documentation, proper receipts and a physical showroom you can visit before you buy.", icon: "M4 20V9l8-5 8 5v11M9 20v-6h6v6" },
  { title: "Professional service", body: "A dedicated advisor from first enquiry to handover — by phone, WhatsApp or in person.", icon: "M5 18v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
];

export default async function HomePage() {
  const [site, featured, facets] = await Promise.all([getSite(), featuredVehicles(4), inventoryFacets()]);
  const latest = await latestAvailable(8, featured.map((f) => f.id));
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, I'd like to enquire about a car.`);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[640px] items-end overflow-hidden bg-ink pt-16 sm:min-h-[720px] lg:h-[92vh] lg:max-h-[900px]">
        <Image src="/demo/hero.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover object-center opacity-80" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/55 to-ink/30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/80 via-ink/20 to-transparent" />
        <div className="container-x pb-12 sm:pb-16 lg:pb-20">
          <div className="max-w-2xl animate-fade-up">
            <p className="eyebrow !text-gold-bright">Lagos · Premium automotive</p>
            <h1 className="mt-4 text-[2.6rem] leading-[1.02] font-semibold text-white sm:text-6xl lg:text-7xl" style={{ fontStretch: "112%" }}>
              Drive what<br />you deserve.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">
              {site.name} offers hand-picked brand new and foreign used vehicles with honest Naira pricing, full specifications and a team that sees you all the way to the keys.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/cars" variant="gold" size="lg">Explore available cars</LinkButton>
              <LinkButton href="#contact" variant="light" size="lg">Contact us</LinkButton>
            </div>
          </div>

          {/* Quick search */}
          <form action="/cars" className="mt-10 grid max-w-4xl grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2 backdrop-blur-md sm:mt-14 sm:grid-cols-4">
            <select name="brand" aria-label="Brand" className="field-dark col-span-1 [&>option]:text-ink" defaultValue="">
              <option value="">Any brand</option>
              {facets.brands.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select name="body" aria-label="Body type" className="field-dark [&>option]:text-ink" defaultValue="">
              <option value="">Any body type</option>
              {facets.bodies.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select name="priceMax" aria-label="Maximum price" className="field-dark [&>option]:text-ink" defaultValue="">
              <option value="">Any price</option>
              {[20, 40, 60, 100, 150, 250].map((m) => <option key={m} value={m * 1_000_000}>Up to ₦{m}M</option>)}
            </select>
            <button className={btn("gold", "md", "col-span-2 h-auto min-h-11 sm:col-span-1")}>Search cars</button>
          </form>
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="container-x py-16 sm:py-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Featured</p>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Hand-picked this month</h2>
            </div>
            <Link href="/cars" className="hidden text-sm font-medium text-ink underline-offset-4 hover:underline sm:block">View all inventory →</Link>
          </div>
          <VehicleGrid items={featured} priorityFirst />
        </section>
      )}

      {/* Latest */}
      <section className="bg-mist/70 py-16 sm:py-20">
        <div className="container-x">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Available now</p>
              <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Latest arrivals</h2>
            </div>
            <Link href="/cars" className="text-sm font-medium text-ink underline-offset-4 hover:underline">See all →</Link>
          </div>
          {latest.length ? <VehicleGrid items={latest} /> : <p className="text-muted">New stock is on its way — check back soon or <Link href="#contact" className="underline">ask us</Link> what&apos;s arriving.</p>}
        </div>
      </section>

      {/* Why us */}
      <section className="bg-ink py-16 text-white sm:py-24">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow !text-gold-bright">Why {site.name}</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Buying a car should feel this straightforward.</h2>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((w) => (
              <div key={w.title} className="bg-ink p-6 sm:p-8">
                <div className="grid size-11 place-items-center rounded-xl bg-gold-bright/10 text-gold-bright">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={w.icon} /></svg>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{w.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agents teaser */}
      <section className="container-x py-16 sm:py-20">
        <div className="grid items-center gap-8 overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-card sm:p-10 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="eyebrow">Agent referral program</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Know someone buying a car? Earn 10% of our profit on the sale.</h2>
            <p className="mt-3 max-w-xl text-muted">Register free, share your personal link, and track every referral and commission from your own dashboard.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <LinkButton href="/agents" variant="outline" size="lg">How it works</LinkButton>
            <LinkButton href="/agents/register" size="lg">Become an agent</LinkButton>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 bg-graphite py-16 text-white sm:py-24">
        <div className="container-x grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow !text-gold-bright">Contact</p>
            <h2 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Talk to an advisor</h2>
            <p className="mt-4 max-w-md text-white/60">Ask about a car, book an inspection or request a vehicle we don&apos;t have in stock yet.</p>
            <div className="mt-8 space-y-3">
              <a href={wa} target="_blank" rel="noopener noreferrer" className={btn("gold", "lg", "w-full sm:w-auto")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1.9 2 1.2 2.3 1.4.3.1.4.1.6-.1l.8-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.2 1.2Z" /></svg>
                Chat on WhatsApp
              </a>
              <dl className="grid gap-4 pt-4 text-sm sm:grid-cols-2">
                <div><dt className="text-white/40">Phone</dt><dd className="mt-1"><a href={`tel:${site.phone.replace(/\s/g, "")}`} className="text-white hover:text-gold-bright">{site.phone}</a></dd></div>
                <div><dt className="text-white/40">Email</dt><dd className="mt-1"><a href={`mailto:${site.email}`} className="text-white hover:text-gold-bright">{site.email}</a></dd></div>
                <div className="sm:col-span-2"><dt className="text-white/40">Showroom</dt><dd className="mt-1 text-white">{site.address}</dd><dd className="text-white/50">{site.hours}</dd></div>
              </dl>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-8">
            <ContactForm dark />
          </div>
        </div>
      </section>
    </>
  );
}
