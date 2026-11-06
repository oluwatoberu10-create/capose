"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { btn } from "@/components/ui";
import { useSavedIds } from "./saved";

const NAV = [
  { href: "/cars", label: "Inventory" },
  { href: "/agents", label: "Agent Program" },
  { href: "/contact", label: "Contact" },
];

export function Logo({ name, light }: { name: string; light?: boolean }) {
  const [first, ...rest] = name.split(" ");
  return (
    <span className={`flex items-center gap-2.5 ${light ? "text-white" : "text-ink"}`}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M8 22.5 16 8l8 14.5M11.4 17h9.2" stroke="#c9a96a" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ filter: light ? "none" : undefined }} /></svg>
      <span className="font-display text-[17px] font-semibold tracking-tight whitespace-nowrap">
        {first}<span className="font-normal text-gold-bright"> {rest.join(" ")}</span>
      </span>
    </span>
  );
}

export function SiteHeader({ name, whatsappHref, account }: { name: string; whatsappHref: string; account: { label: string; href: string } | null }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const path = usePathname();
  const saved = useSavedIds();
  const overHero = path === "/" && !scrolled;

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${overHero && !open ? "bg-transparent" : "border-b border-white/5 bg-ink/95 backdrop-blur-md"}`}>
      <div className="container-x flex h-16 items-center justify-between gap-4 lg:h-[72px]">
        <Link href="/" aria-label={`${name} home`}><Logo name={name} light /></Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`rounded-lg px-3.5 py-2 text-sm transition ${path.startsWith(n.href) ? "text-white" : "text-white/65 hover:text-white"}`}>{n.label}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link href="/saved" className="relative grid size-10 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white" aria-label={`Saved cars (${saved.length})`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z" strokeLinejoin="round" /></svg>
            {saved.length > 0 && <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-gold-bright text-[10px] font-bold text-ink">{saved.length}</span>}
          </Link>
          {account && <Link href={account.href} className="hidden rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white lg:block">{account.label}</Link>}
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={btn("gold", "sm", "max-sm:hidden")}>WhatsApp us</a>
          <button type="button" className="grid size-10 place-items-center rounded-lg text-white md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-ink md:hidden">
          <nav className="container-x flex flex-col py-6" aria-label="Mobile">
            {[{ href: "/", label: "Home" }, ...NAV, { href: "/saved", label: `Saved cars${saved.length ? ` (${saved.length})` : ""}` }, ...(account ? [account] : [{ href: "/agents/login", label: "Agent login" }])].map((n) => (
              <Link key={n.href} href={n.href} className="border-b border-white/8 py-4 font-display text-2xl text-white">{n.label}</Link>
            ))}
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={btn("gold", "lg", "mt-8")}>Chat on WhatsApp</a>
          </nav>
        </div>
      )}
    </header>
  );
}
