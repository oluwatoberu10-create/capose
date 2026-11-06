import { Suspense } from "react";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { RefTracker } from "@/components/site/ref-tracker";
import { AgentCodeSync } from "@/components/site/agent-code-sync";
import { getPrincipal } from "@/server/auth";
import { getSite } from "@/server/settings";
import { whatsappLink } from "@/lib/format";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [site, p] = await Promise.all([getSite(), getPrincipal()]);
  const account = p?.kind === "agent" ? { label: "Agent dashboard", href: "/agents/dashboard" }
    : p?.kind === "admin" ? { label: "Admin", href: "/admin" } : null;
  return (
    <>
      <SiteHeader name={site.name} whatsappHref={whatsappLink(site.whatsapp, `Hello ${site.name}, I'd like to enquire about a car.`)} account={account} />
      <main className="min-h-[70vh]">{children}</main>
      <SiteFooter site={site} />
      <Suspense><RefTracker /></Suspense>
      <AgentCodeSync code={p?.kind === "agent" && p.agentStatus === "approved" ? p.referralCode : null} />
    </>
  );
}
