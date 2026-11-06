import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { Logo } from "@/components/site/header";
import { getPrincipal } from "@/server/auth";
import { getSite } from "@/server/settings";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const p = await getPrincipal();
  if (p?.kind === "admin") redirect("/admin");
  const [{ next }, site] = await Promise.all([searchParams, getSite()]);
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden bg-ink lg:block">
        <Image src="/demo/range-rover-black.jpg" alt="" fill sizes="50vw" className="object-cover opacity-60" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <Logo name={site.name} light />
          <p className="mt-4 max-w-sm text-white/60">Inventory, orders, CRM, finance and agent commissions — in one place.</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-paper px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><span className="inline-block rounded-xl bg-ink p-3"><Logo name={site.name} light /></span></div>
          <h1 className="text-2xl font-semibold">Admin sign in</h1>
          <p className="mt-1 mb-8 text-sm text-muted">Authorised staff only.</p>
          <LoginForm role="admin" next={next} />
        </div>
      </div>
    </div>
  );
}
