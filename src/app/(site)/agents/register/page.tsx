import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { getPrincipal } from "@/server/auth";

export const metadata: Metadata = { title: "Agent registration" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const p = await getPrincipal();
  if (p?.kind === "agent") redirect("/agents/dashboard");
  return (
    <div className="pt-24 pb-20 sm:pt-32">
      <div className="container-x max-w-xl">
        <Link href="/agents" className="text-[13px] text-muted hover:text-ink">← Referral program</Link>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Become an agent</h1>
        <p className="mt-2 text-muted">Earn 10% of the profit on every car you refer. Free to join.</p>
        <div className="card mt-8 p-5 sm:p-8"><RegisterForm /></div>
        <p className="mt-6 text-center text-sm text-muted">Already an agent? <Link href="/agents/login" className="font-medium text-ink underline">Log in</Link></p>
      </div>
    </div>
  );
}
