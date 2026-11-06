import type { Metadata } from "next";
import { ContactForm } from "@/components/site/contact-form";
import { btn } from "@/components/ui";
import { whatsappLink } from "@/lib/format";
import { getSite } from "@/server/settings";

export const metadata: Metadata = { title: "Contact us" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const site = await getSite();
  return (
    <>
      <section className="bg-ink pt-28 pb-12 text-white sm:pt-32 sm:pb-16">
        <div className="container-x">
          <p className="eyebrow !text-gold-bright">Contact</p>
          <h1 className="mt-3 text-4xl font-semibold text-white sm:text-5xl">We&apos;re here to help</h1>
          <p className="mt-3 max-w-xl text-white/60">Questions about a car, inspections, trade-ins or a vehicle you can&apos;t find in our inventory — get in touch.</p>
        </div>
      </section>
      <section className="container-x grid gap-10 py-12 sm:py-16 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          {[
            ["WhatsApp", site.whatsapp, whatsappLink(site.whatsapp, `Hello ${site.name}`)],
            ["Phone", site.phone, `tel:${site.phone.replace(/\s/g, "")}`],
            ["Email", site.email, `mailto:${site.email}`],
          ].map(([label, value, href]) => (
            <a key={label} href={href} target={label === "WhatsApp" ? "_blank" : undefined} rel="noopener noreferrer" className="card flex items-center justify-between p-5 transition hover:shadow-lift">
              <div><p className="text-[13px] text-muted">{label}</p><p className="mt-0.5 font-medium text-ink">{value}</p></div>
              <span className="text-gold">→</span>
            </a>
          ))}
          <div className="card p-5">
            <p className="text-[13px] text-muted">Showroom</p>
            <p className="mt-0.5 font-medium text-ink">{site.address}</p>
            <p className="mt-1 text-sm text-muted">{site.hours}</p>
            <a href={`https://maps.google.com/?q=${encodeURIComponent(site.address)}`} target="_blank" rel="noopener noreferrer" className={btn("outline", "sm", "mt-4")}>Open in Maps</a>
          </div>
        </div>
        <div className="card p-5 sm:p-8">
          <h2 className="text-xl font-semibold">Send us a message</h2>
          <p className="mt-1 mb-6 text-sm text-muted">We usually reply within a few business hours.</p>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
