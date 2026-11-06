import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { TableFilters } from "@/components/admin/filters";
import { VehicleQuickActions } from "@/components/admin/vehicle-actions";
import { AvailabilityBadge, Badge, EmptyState, LinkButton, Notice, PageHeader, Pagination, TableWrap } from "@/components/ui";
import { ADMIN_PAGE_SIZE, AVAILABILITY_LABEL } from "@/lib/constants";
import { expectedProfit, publicPrice } from "@/lib/finance";
import { naira } from "@/lib/format";
import { can, pageAdmin } from "@/server/auth";
import { listAdminVehicles } from "@/server/services/vehicles";

export const metadata = { title: "Vehicles" };

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await pageAdmin("inventory");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listAdminVehicles({ q: sp.q, availability: sp.status, page, pageSize: ADMIN_PAGE_SIZE });
  const finance = can(admin, "finance");
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const href = (p: number) => `/admin/vehicles?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Vehicles" subtitle={`${total} listing${total === 1 ? "" : "s"}`} actions={<LinkButton href="/admin/vehicles/new">+ Add vehicle</LinkButton>} />
      {sp.deleted && <div className="mb-4"><Notice tone="info">Vehicle deleted.</Notice></div>}
      <Suspense><TableFilters placeholder="Search title, brand, model, stock # or VIN…" statuses={Object.entries(AVAILABILITY_LABEL).map(([value, label]) => ({ value, label }))} /></Suspense>

      {rows.length === 0 ? (
        <EmptyState title={sp.q || sp.status ? "No vehicles match" : "No vehicles yet"} body={sp.q || sp.status ? "Try a different search or filter." : "Add your first car to start building the inventory."} action={<LinkButton href="/admin/vehicles/new">Add vehicle</LinkButton>} />
      ) : (
        <>
          <div className="hidden md:block">
            <TableWrap>
              <table className="table-x">
                <thead><tr><th>Vehicle</th><th>Stock #</th><th className="text-right">Price</th>{finance && <th className="text-right">Exp. profit</th>}<th className="text-center">Stock</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {rows.map((v) => {
                    const { price } = publicPrice(v);
                    const profit = expectedProfit(v);
                    return (
                      <tr key={v.id}>
                        <td>
                          <Link href={`/admin/vehicles/${v.id}`} className="flex items-center gap-3">
                            <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-mist">{v.cover && <Image src={v.cover} alt="" fill sizes="64px" className="object-cover" />}</span>
                            <span className="min-w-0"><span className="block truncate font-medium text-ink hover:underline">{v.title}</span>
                              <span className="flex gap-1.5">{v.featured && <Badge tone="gold">Featured</Badge>}{!v.published && <Badge>Hidden</Badge>}{v.isDemo && <Badge tone="info">Demo</Badge>}</span></span>
                          </Link>
                        </td>
                        <td className="font-mono text-[12.5px] text-muted">{v.stockNumber}</td>
                        <td className="text-right tabular-nums">{naira(price)}</td>
                        {finance && <td className={`text-right tabular-nums ${v.purchaseCost ? (profit < 0 ? "text-bad" : "text-ok") : "text-stone"}`}>{v.purchaseCost ? naira(profit) : "No cost"}</td>}
                        <td className="text-center tabular-nums">{v.stockQuantity}<span className="text-stone">{v.reservedQuantity ? ` +${v.reservedQuantity}r` : ""}</span></td>
                        <td><AvailabilityBadge value={v.availability} />{v.availabilityOverride && <span className="ml-1 text-[11px] text-stone" title="Set manually">(manual)</span>}</td>
                        <td className="text-right"><div className="flex justify-end gap-1"><LinkButton href={`/admin/vehicles/${v.id}`} variant="outline" size="sm">Edit</LinkButton><VehicleQuickActions id={v.id} featured={v.featured} published={v.published} override={v.availabilityOverride} /></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </div>
          <div className="space-y-3 md:hidden">
            {rows.map((v) => (
              <div key={v.id} className="card flex gap-3 p-3">
                <Link href={`/admin/vehicles/${v.id}`} className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-mist">{v.cover && <Image src={v.cover} alt="" fill sizes="96px" className="object-cover" />}</Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/vehicles/${v.id}`} className="block truncate font-medium text-ink">{v.title}</Link>
                  <p className="text-[12.5px] text-muted">#{v.stockNumber} · {v.stockQuantity} in stock</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2"><span className="font-semibold tabular-nums">{naira(publicPrice(v).price)}</span><AvailabilityBadge value={v.availability} /></div>
                </div>
                <VehicleQuickActions id={v.id} featured={v.featured} published={v.published} override={v.availabilityOverride} />
              </div>
            ))}
          </div>
          <Pagination page={page} pages={pages} href={href} />
        </>
      )}
    </>
  );
}
