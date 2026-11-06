import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Badge, LinkButton, ORDER_TONES, PAY_TONES, StatusBadge, btn } from "@/components/ui";
import { CarPlaceholder } from "@/components/site/vehicle-card";
import { ORDER_PAYMENT_LABEL, ORDER_STATUS_LABEL } from "@/lib/constants";
import { formatDateTime, naira, whatsappLink } from "@/lib/format";
import { getOrderByToken } from "@/server/services/orders";
import { getSite } from "@/server/settings";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderConfirmation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [data, site] = await Promise.all([getOrderByToken(token), getSite()]);
  if (!data) notFound();
  const { order, customer, items } = data;
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, I just placed order ${order.reference}.`);

  return (
    <div className="pt-24 pb-20 sm:pt-28">
      <div className="container-x max-w-3xl">
        <div className="text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-[#e7f4ec] text-2xl text-ok">✓</div>
          <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">Order request received</h1>
          <p className="mx-auto mt-3 max-w-lg text-muted">Thank you, {customer.name.split(" ")[0]}. Our team will call you on <strong className="text-ink">{customer.phone}</strong> to confirm availability and next steps.</p>
          <div className="mt-6 inline-flex flex-col items-center rounded-xl border border-line bg-white px-6 py-4 shadow-card">
            <span className="text-[12px] uppercase tracking-[0.18em] text-muted">Order reference</span>
            <span className="mt-1 font-display text-2xl font-semibold tracking-wide text-ink">{order.reference}</span>
          </div>
        </div>

        <div className="mt-10 card overflow-hidden">
          {items.map(({ item, cover }) => (
            <div key={item.id} className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-center">
              <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-lg bg-mist sm:w-40">
                {cover ? <Image src={cover} alt={item.vehicleTitle} fill sizes="160px" className="object-cover" /> : <CarPlaceholder className="absolute inset-0" />}
              </div>
              <div className="flex-1">
                <p className="font-display font-semibold text-ink">{item.vehicleTitle}</p>
                <p className="mt-1 text-sm text-muted">{item.colorName ? `${item.colorName} · ` : ""}Qty {item.quantity} × {naira(item.unitPrice)}</p>
              </div>
              <p className="font-display text-lg font-semibold tabular-nums text-ink">{naira(item.lineTotal)}</p>
            </div>
          ))}
          <dl className="grid gap-3 p-5 text-sm sm:grid-cols-2">
            <div className="flex justify-between sm:block"><dt className="text-muted">Order status</dt><dd className="mt-1"><StatusBadge value={order.status} map={ORDER_TONES} labels={ORDER_STATUS_LABEL} /></dd></div>
            <div className="flex justify-between sm:block"><dt className="text-muted">Payment status</dt><dd className="mt-1"><StatusBadge value={order.paymentStatus} map={PAY_TONES} labels={ORDER_PAYMENT_LABEL} /></dd></div>
            <div className="flex justify-between sm:block"><dt className="text-muted">Placed</dt><dd className="mt-1 font-medium text-ink">{formatDateTime(order.createdAt)}</dd></div>
            <div className="flex justify-between sm:block"><dt className="text-muted">Total</dt><dd className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">{naira(order.total)}</dd></div>
          </dl>
        </div>

        <div className="mt-6 rounded-xl border border-[#ead9b8] bg-gold-soft px-5 py-4 text-sm leading-relaxed text-[#6b5326]">
          <Badge tone="gold" className="mb-2">Payment</Badge>
          <p>Online payment will be enabled later. <strong>You have not been charged.</strong> Once we confirm your order, an advisor will share payment options (bank transfer or in-showroom). Please only pay into accounts confirmed by {site.name} staff.</p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a href={wa} target="_blank" rel="noopener noreferrer" className={btn("gold", "lg")}>Message us on WhatsApp</a>
          <LinkButton href="/cars" variant="outline" size="lg">Continue browsing</LinkButton>
        </div>
        <p className="mt-6 text-center text-[12px] text-stone">Bookmark this page to check your order status later.</p>
      </div>
    </div>
  );
}
