import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Checkout } from "@/components/site/checkout";
import { LinkButton } from "@/components/ui";
import { isOrderable, publicPrice } from "@/lib/finance";
import { paymentProviders } from "@/server/payments";
import { getPublicVehicle } from "@/server/services/vehicles";

export const metadata: Metadata = { title: "Order request", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ color?: string }> }) {
  const [{ slug }, { color }] = await Promise.all([params, searchParams]);
  const v = await getPublicVehicle(slug);
  if (!v) notFound();
  const orderable = isOrderable(v.availability) && v.stockQuantity > 0;
  const cover = (v.images.find((i) => i.colorId === color) ?? v.images[0])?.url ?? null;

  return (
    <div className="pt-24 pb-16 sm:pt-28">
      <div className="container-x">
        <Link href={`/cars/${v.slug}`} className="text-[13px] text-muted hover:text-ink">← Back to {v.title}</Link>
        <h1 className="mt-3 mb-8 text-3xl font-semibold sm:text-4xl">Order this car</h1>
        {orderable ? (
          <Checkout
            vehicle={{ id: v.id, title: v.title, year: v.year, slug: v.slug, cover, stock: v.stockQuantity, colors: v.colors }}
            unitPrice={publicPrice(v).price} initialColorId={color ?? null} providers={paymentProviders()}
          />
        ) : (
          <div className="card max-w-xl p-6">
            <p className="font-semibold text-ink">This car can&apos;t be ordered right now.</p>
            <p className="mt-2 text-sm text-muted">It is currently {v.availability.replace(/_/g, " ")}. You can ask to be notified when it&apos;s back, or contact us about similar cars.</p>
            <div className="mt-5 flex gap-2"><LinkButton href={`/cars/${v.slug}`}>Back to listing</LinkButton><LinkButton href="/contact" variant="outline">Contact dealer</LinkButton></div>
          </div>
        )}
      </div>
    </div>
  );
}
