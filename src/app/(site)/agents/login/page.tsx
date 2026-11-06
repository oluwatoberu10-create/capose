import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getPrincipal } from "@/server/auth";

export const metadata: Metadata = { title: "Agent login" };
export const dynamic = "force-dynamic";

export default async function AgentLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const p = await getPrincipal();
  if (p?.kind === "agent") redirect("/agents/dashboard");
  const { next } = await searchParams;
  return (
    <div className="pt-24 pb-20 sm:pt-32">
      <div className="container-x max-w-md">
        <h1 className="text-3xl font-semibold sm:text-4xl">Agent login</h1>
        <p className="mt-2 text-muted">Access your referral link, referrals and commissions.</p>
        <div className="card mt-8 p-5 sm:p-8"><LoginForm role="agent" next={next} /></div>
        <p className="mt-6 text-center text-sm text-muted">New here? <Link href="/agents/register" className="font-medium text-ink underline">Register as an agent</Link></p>
        <p className="mt-2 text-center text-[13px] text-stone">Forgot your password? Contact the dealership to reset it.</p>
      </div>
    </div>
  );
}
