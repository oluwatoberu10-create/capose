import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, LinkButton, Pagination } from "@/components/ui";
import { VehicleGrid } from "@/components/site/vehicle-card";
import { InventorySidebar, InventoryToolbar } from "@/components/site/inventory-filters";
import { inventoryFacets, listPublicVehicles, parseInventoryFilters } from "@/server/services/vehicles";

export const metadata: Metadata = { title: "Inventory" };
export const dynamic = "force-dynamic";

export default async function CarsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters = parseInventoryFilters(sp);
  const [result, facets] = await Promise.all([listPublicVehicles(filters), inventoryFacets()]);
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") q.set(k, v);
    if (p > 1) q.set("page", String(p));
    return `/cars${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <section className="bg-ink pt-28 pb-10 text-white sm:pt-32 sm:pb-14">
        <div className="container-x">
          <p className="eyebrow !text-gold-bright">Inventory</p>
          <h1 className="mt-3 text-4xl font-semibold text-white sm:text-5xl">Find your next car</h1>
          <p className="mt-3 max-w-xl text-white/60">Brand new, foreign used and Nigerian used vehicles, priced in Naira. Out-of-stock cars stay listed so you can ask to be notified.</p>
        </div>
      </section>
      <section className="container-x py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <Suspense><InventorySidebar facets={facets} /></Suspense>
          <div className="min-w-0">
            <Suspense><InventoryToolbar facets={facets} total={result.total} /></Suspense>
            <div className="mt-5">
              {result.items.length ? (
                <VehicleGrid items={result.items} priorityFirst narrow />
              ) : (
                <EmptyState title="No cars match those filters" body="Try widening your price range or clearing a filter. You can also tell us what you're looking for." action={<div className="flex gap-2"><LinkButton href="/cars" variant="outline">Clear filters</LinkButton><LinkButton href="/contact">Request a car</LinkButton></div>} />
              )}
            </div>
            <Pagination page={result.page} pages={result.pages} href={href} />
          </div>
        </div>
      </section>
    </>
  );
}
