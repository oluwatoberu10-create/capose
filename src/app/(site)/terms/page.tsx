import type { Metadata } from "next";
import { getSite } from "@/server/settings";

export const metadata: Metadata = { title: "Terms and conditions" };
export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const site = await getSite();
  return (
    <div className="container-x max-w-3xl pt-28 pb-20 sm:pt-32">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 text-4xl font-semibold">Terms &amp; conditions</h1>
      <p className="mt-2 text-sm text-stone">Template — have this reviewed by your legal adviser before launch.</p>
      <div className="prose-x mt-8">
        <h2>Listings and prices</h2>
        <p>We work to keep listings accurate, but specifications, availability and prices may change without notice and are confirmed only when {site.name} confirms your order. All prices are in Nigerian Naira.</p>
        <h2>Order requests</h2>
        <p>Submitting an order on this website is a request to purchase, not a completed sale. An order is binding only once confirmed by our staff and payment has been received. Online payment is not yet available; never pay into an account that has not been confirmed by {site.name} staff.</p>
        <h2>Inspection and handover</h2>
        <p>You are welcome to inspect any vehicle before payment. Ownership passes on full payment and handover of documents.</p>
        <h2>Agent referral program</h2>
        <ul>
          <li>Agents earn a commission of 10% of the dealership&apos;s actual net profit on a vehicle sale they referred — not 10% of the selling price.</li>
          <li>Net profit is the sale amount less the vehicle&apos;s acquisition cost and the expenses of that sale, as recorded by {site.name}.</li>
          <li>No commission is earned when a sale makes no profit.</li>
          <li>Commissions are approved only after the sale is completed and fully paid, and are paid manually by {site.name}. We may decline or reverse attribution in cases of misuse.</li>
          <li>Agents are independent and may not make promises or collect payments on behalf of {site.name}.</li>
        </ul>
        <h2>Contact</h2>
        <p>Questions about these terms: {site.email}.</p>
      </div>
    </div>
  );
}
