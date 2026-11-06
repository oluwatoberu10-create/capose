import Link from "next/link";
import type { SiteSettings } from "@/server/settings";
import { whatsappLink } from "@/lib/format";
import { Logo } from "./header";

export function SiteFooter({ site }: { site: SiteSettings }) {
  const socials = [
    { label: "Instagram", href: site.instagram },
    { label: "Facebook", href: site.facebook },
    { label: "X", href: site.x },
    { label: "TikTok", href: site.tiktok },
  ].filter((s) => s.href);
  return (
    <footer className="bg-ink text-white/60">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:py-16">
        <div>
          <Logo name={site.name} light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">{site.tagline} Inspected vehicles, transparent Naira pricing and a team that picks up the phone.</p>
          {socials.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white/80 hover:border-gold-bright hover:text-white">{s.label}</a>)}
            </div>
          ) : (
            <p className="mt-6 text-xs text-white/35">Social media links appear here once added in Admin → Settings.</p>
          )}
        </div>
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">Explore</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/" className="hover:text-white">Home</Link></li>
            <li><Link href="/cars" className="hover:text-white">Inventory</Link></li>
            <li><Link href="/cars?condition=brand_new" className="hover:text-white">Brand new cars</Link></li>
            <li><Link href="/saved" className="hover:text-white">Saved cars</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact us</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">Agents</p>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/agents" className="hover:text-white">Referral program</Link></li>
            <li><Link href="/agents/register" className="hover:text-white">Become an agent</Link></li>
            <li><Link href="/agents/login" className="hover:text-white">Agent login</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">Visit us</p>
          <address className="space-y-2.5 text-sm not-italic">
            <p>{site.address}</p>
            <p>{site.hours}</p>
            <p><a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hover:text-white">{site.phone}</a></p>
            <p><a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a></p>
            <p><a href={whatsappLink(site.whatsapp)} target="_blank" rel="noopener noreferrer" className="text-gold-bright hover:text-white">WhatsApp →</a></p>
          </address>
        </div>
      </div>
      <div className="border-t border-white/8">
        <div className="container-x flex flex-col gap-3 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white">Privacy policy</Link>
            <Link href="/terms" className="hover:text-white">Terms &amp; conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
