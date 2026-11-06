import type { Metadata } from "next";
import { getSite } from "@/server/settings";

export const metadata: Metadata = { title: "Privacy policy" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const site = await getSite();
  return (
    <div className="container-x max-w-3xl pt-28 pb-20 sm:pt-32">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 text-4xl font-semibold">Privacy policy</h1>
      <p className="mt-2 text-sm text-stone">Template — have this reviewed by your legal adviser before launch.</p>
      <div className="prose-x mt-8">
        <p>{site.name} (&ldquo;we&rdquo;) respects your privacy. This policy explains what personal data we collect through this website and how we use it, in line with the Nigeria Data Protection Act 2023.</p>
        <h2>What we collect</h2>
        <ul>
          <li>Details you submit in order requests, enquiries and &ldquo;notify me&rdquo; requests: name, phone number, email address and your message.</li>
          <li>For registered agents: name, email, phone number, a securely hashed password, and referral activity.</li>
          <li>A referral cookie when you arrive through an agent&apos;s link, so the agent can be credited if you buy.</li>
          <li>Saved cars, stored only in your own browser unless you are a signed-in agent.</li>
        </ul>
        <h2>How we use it</h2>
        <p>To respond to enquiries, process and confirm orders, record sales, pay agent commissions, and meet our legal and accounting obligations. We do not sell your data.</p>
        <h2>Payments</h2>
        <p>This website does not currently collect card or bank details. When online payment is introduced it will be processed by a licensed payment provider.</p>
        <h2>Retention and your rights</h2>
        <p>We keep records for as long as needed for these purposes and for statutory accounting periods. You may request access to, correction of, or deletion of your data by contacting us at {site.email}.</p>
        <h2>Contact</h2>
        <p>{site.name}, {site.address}. Email: {site.email}. Phone: {site.phone}.</p>
      </div>
    </div>
  );
}
