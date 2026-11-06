"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/site/header";
import { logout } from "@/server/actions/auth";

type Item = { href: string; label: string; icon: string; perm: string; badge?: number };
type Group = { title: string; items: Item[] };

const I = {
  home: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  car: "M3 13l2-6h14l2 6M5 13h14v5H5zM7 18v2M17 18v2",
  plus: "M12 5v14M5 12h14",
  cart: "M4 5h2l2 10h10l2-7H7M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13 9v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  key: "M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7Z",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-4v4M17 14h.01",
  file: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  badge: "M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  coins: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3ZM4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  cash: "M2 7h20v10H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  cog: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
};

export function AdminShell({ children, user, permissions, counts, siteName }: {
  children: React.ReactNode; user: { name: string; role: string }; permissions: string[];
  counts: { pendingOrders: number; newEnquiries: number; pendingAgents: number; pendingCommissions: number }; siteName: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const groups: Group[] = [
    { title: "", items: [{ href: "/admin", label: "Dashboard", icon: I.home, perm: "inventory" }] },
    { title: "Inventory", items: [
      { href: "/admin/vehicles", label: "Vehicles", icon: I.car, perm: "inventory" },
      { href: "/admin/vehicles/new", label: "Add vehicle", icon: I.plus, perm: "inventory" },
    ] },
    { title: "Customers", items: [
      { href: "/admin/orders", label: "Orders", icon: I.cart, perm: "orders", badge: counts.pendingOrders },
      { href: "/admin/customers", label: "Customers", icon: I.users, perm: "customers" },
      { href: "/admin/enquiries", label: "Enquiries", icon: I.mail, perm: "enquiries", badge: counts.newEnquiries },
    ] },
    { title: "CRM & finance", items: [
      { href: "/admin/crm", label: "Financial dashboard", icon: I.chart, perm: "finance" },
      { href: "/admin/crm/sales", label: "Sales records", icon: I.receipt, perm: "finance" },
      { href: "/admin/crm/acquisitions", label: "Acquisitions", icon: I.key, perm: "finance" },
      { href: "/admin/crm/expenses", label: "Expenses", icon: I.wallet, perm: "finance" },
      { href: "/admin/crm/reports", label: "Reports", icon: I.file, perm: "finance" },
    ] },
    { title: "Agents", items: [
      { href: "/admin/agents", label: "Agents", icon: I.badge, perm: "agents", badge: counts.pendingAgents },
      { href: "/admin/referrals", label: "Referrals", icon: I.link, perm: "agents" },
      { href: "/admin/commissions", label: "Commissions", icon: I.coins, perm: "agents", badge: counts.pendingCommissions },
      { href: "/admin/payouts", label: "Payouts", icon: I.cash, perm: "agents" },
    ] },
    { title: "", items: [{ href: "/admin/settings", label: "Settings", icon: I.cog, perm: "settings" }] },
  ];
  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => permissions.includes(i.perm)) })).filter((g) => g.items.length);
  const all = visible.flatMap((g) => g.items);
  // Longest matching prefix wins, so /admin/vehicles/new highlights "Add vehicle" not "Vehicles".
  const active = all.filter((i) => path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin">
      {visible.map((g, gi) => (
        <div key={gi} className="mb-4">
          {g.title && <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/35">{g.title}</p>}
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} aria-current={active === i.href ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition ${active === i.href ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={active === i.href ? "text-gold-bright" : ""}><path d={i.icon} /></svg>
              <span className="flex-1">{i.label}</span>
              {!!i.badge && <span className="rounded-full bg-gold-bright px-1.5 text-[10.5px] font-bold text-ink">{i.badge}</span>}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
  const footer = (
    <div className="border-t border-white/10 p-4">
      <p className="truncate text-sm font-medium text-white">{user.name}</p>
      <p className="text-[12px] text-white/45 capitalize">{user.role}</p>
      <div className="mt-3 flex gap-2 text-[12.5px]">
        <Link href="/" target="_blank" className="rounded-md border border-white/15 px-2.5 py-1 text-white/70 hover:text-white">View site ↗</Link>
        <form action={logout}><button className="rounded-md border border-white/15 px-2.5 py-1 text-white/70 hover:text-white">Log out</button></form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f5f2]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-ink lg:flex">
        <div className="flex h-16 items-center border-b border-white/10 px-5"><Link href="/admin"><Logo name={siteName} light /></Link></div>
        {nav}{footer}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-ink px-4 lg:hidden">
        <Link href="/admin"><Logo name={siteName} light /></Link>
        <button type="button" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-lg text-white" aria-label="Open menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-ink shadow-lift">
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              <Logo name={siteName} light />
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg text-white/70" aria-label="Close menu">✕</button>
            </div>
            {nav}{footer}
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
