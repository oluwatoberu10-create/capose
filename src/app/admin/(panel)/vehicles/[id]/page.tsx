import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customerNotifications, vehicleAcquisitions } from "@/db/schema";
import { ImageManager } from "@/components/admin/image-manager";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { ConfirmAction } from "@/components/form";
import { AvailabilityBadge, Badge, LinkButton, Notice, PageHeader } from "@/components/ui";
import { formatDate, naira } from "@/lib/format";
import { deleteVehicle } from "@/server/actions/admin-vehicles";
import { can, pageAdmin } from "@/server/auth";
import { getAdminVehicle } from "@/server/services/vehicles";
import { getSite } from "@/server/settings";

export const metadata = { title: "Edit vehicle" };

export default async function EditVehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const admin = await pageAdmin("inventory");
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [v, site] = await Promise.all([getAdminVehicle(id), getSite()]);
  if (!v) notFound();
  const finance = can(admin, "finance");
  const [acqs, waiting] = await Promise.all([
    finance ? db.select().from(vehicleAcquisitions).where(eq(vehicleAcquisitions.vehicleId, id)).orderBy(desc(vehicleAcquisitions.purchaseDate)) : Promise.resolve([]),
    db.select().from(customerNotifications).where(and(eq(customerNotifications.vehicleId, id), eq(customerNotifications.status, "waiting"))),
  ]);

  return (
    <>
      <PageHeader
        title={v.title}
        back={{ href: "/admin/vehicles", label: "Vehicles" }}
        subtitle={<span className="flex flex-wrap items-center gap-2">Stock #{v.stockNumber} <AvailabilityBadge value={v.availability} />{!v.published && <Badge>Hidden</Badge>}{v.isDemo && <Badge tone="info">Demo</Badge>}</span>}
        actions={<>
          <LinkButton href={`/cars/${v.slug}`} variant="outline" size="sm" target="_blank">View listing ↗</LinkButton>
          {finance && <LinkButton href={`/admin/crm/sales/new?vehicle=${v.id}`} size="sm">Record sale</LinkButton>}
          <ConfirmAction action={deleteVehicle} fields={{ id: v.id }} label="Delete" confirmTitle={`Delete ${v.title}?`} confirmBody="This permanently removes the listing, its colours, features and photos. Vehicles with orders or sales cannot be deleted — unpublish them instead." confirmLabel="Delete vehicle" />
        </>}
      />
      <div className="mb-6 space-y-3">
        {created && <Notice tone="info"><strong>Vehicle created.</strong> Now add photos below — the first photo becomes the featured image.</Notice>}
        {waiting.length > 0 && <Notice tone="gold"><strong>{waiting.length} customer{waiting.length > 1 ? "s" : ""} asked to be notified</strong> when this car is available: {waiting.map((w) => `${w.name} (${w.phone})`).join(", ")}. <Link href="/admin/enquiries?tab=notify" className="underline">Manage →</Link></Notice>}
      </div>
      <div className="mb-6"><ImageManager vehicleId={v.id} images={v.images} colors={v.colors} /></div>
      {/* Remount after every save so new colour ids are picked up; costs never reach sales staff's browser. */}
      <VehicleForm key={v.updatedAt.toISOString()} initial={finance ? v : { ...v, purchaseCost: 0, additionalExpenses: 0 }} canSeeCosts={finance} featureSuggestions={site.featureSuggestions} />
      {finance && (
        <section className="card mt-6 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold">Acquisition records</h2>
            <LinkButton href={`/admin/crm/acquisitions/new?vehicle=${v.id}`} variant="outline" size="sm">+ Record acquisition</LinkButton>
          </div>
          {acqs.length ? (
            <ul className="mt-4 divide-y divide-line text-sm">
              {acqs.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                  <Link href={`/admin/crm/acquisitions/${a.id}`} className="font-medium text-ink hover:underline">{formatDate(a.purchaseDate)} · {a.seller ?? "Unknown seller"} · {a.units} unit{a.units > 1 ? "s" : ""}</Link>
                  <span className="tabular-nums">{naira(a.totalCost)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">No acquisition recorded. Record what the dealership paid so profit and commissions are accurate.</p>}
        </section>
      )}
    </>
  );
}
