import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleShowcase } from "@/components/site/vehicle-showcase";
import { VehicleGrid } from "@/components/site/vehicle-card";
import { isOrderable, publicPrice } from "@/lib/finance";
import { km, naira, whatsappLink } from "@/lib/format";
import { CONDITION_LABEL } from "@/lib/constants";
import { getPublicVehicle, relatedVehicles } from "@/server/services/vehicles";
import { getSite } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const v = await getPublicVehicle((await params).slug);
  if (!v) return { title: "Car not found" };
  const { price } = publicPrice(v);
  return {
    title: v.title,
    description: `${v.year} ${v.brand} ${v.model}, ${CONDITION_LABEL[v.condition]} — ${naira(price)}. ${v.description.slice(0, 120)}`,
    openGraph: { title: `${v.title} — ${naira(price)}`, images: v.images[0] ? [v.images[0].url] : undefined },
  };
}

export default async function CarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [v, site] = await Promise.all([getPublicVehicle(slug), getSite()]);
  if (!v) notFound();
  const related = await relatedVehicles(v);
  const { price, was } = publicPrice(v);

  const specs: [string, string | number | null][] = [
    ["Brand", v.brand], ["Model", v.model], ["Year", v.year], ["Condition", CONDITION_LABEL[v.condition]],
    ["Body type", v.bodyType], ["Category", v.category || null], ["Engine type", v.engineType], ["Engine capacity", v.engineCapacity],
    ["Horsepower", v.horsepower ? `${v.horsepower} hp` : null], ["Transmission", v.transmission], ["Drive type", v.driveType],
    ["Fuel type", v.fuelType], ["Mileage", v.mileage !== null ? km(v.mileage) : null], ["Exterior colour", v.exteriorColor],
    ["Interior colour", v.interiorColor], ["Doors", v.doors], ["Seats", v.seats], ["Steering", v.steering],
    ["Dimensions", v.dimensions], ["VIN", v.vin], ["Stock number", v.stockNumber],
    ...v.customSpecs.map((s) => [s.label, s.value] as [string, string]),
  ];
  const shown = specs.filter(([, val]) => val !== null && val !== "" && val !== undefined);
  const wa = whatsappLink(site.whatsapp, `Hello ${site.name}, I'm interested in the ${v.title} (stock #${v.stockNumber}) listed at ${naira(price)}.`);

  return (
    <div className="bg-paper pt-20 lg:pt-24">
      <div className="container-x py-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-[13px] text-muted">
          <Link href="/" className="hover:text-ink">Home</Link><span>/</span><Link href="/cars" className="hover:text-ink">Inventory</Link><span>/</span><span className="truncate text-ink">{v.title}</span>
        </nav>
        <VehicleShowcase v={v} price={price} was={was} whatsappHref={wa} orderable={isOrderable(v.availability)} />

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
          <div className="space-y-8">
            {v.description && (
              <section>
                <h2 className="text-xl font-semibold">Overview</h2>
                <div className="mt-3 space-y-3 leading-relaxed text-muted">{v.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>
              </section>
            )}
            <section>
              <h2 className="text-xl font-semibold">Specifications</h2>
              <dl className="mt-4 grid overflow-hidden rounded-xl border border-line bg-white sm:grid-cols-2">
                {shown.map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-line/70 px-4 py-3 text-sm sm:odd:border-r">
                    <dt className="text-muted">{k}</dt><dd className="text-right font-medium text-ink">{val}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
          <section>
            <h2 className="text-xl font-semibold">Features</h2>
            {v.features.length ? (
              <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {v.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-body">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-gold-soft text-[11px] text-gold">✓</span>{f}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-muted">Ask us for the full feature list.</p>}
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-8 border-t border-line bg-mist/60 py-14">
          <div className="container-x">
            <h2 className="mb-6 text-2xl font-semibold">Similar cars</h2>
            <VehicleGrid items={related} />
          </div>
        </section>
      )}
    </div>
  );
}
