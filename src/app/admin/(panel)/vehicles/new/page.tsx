import { sql } from "drizzle-orm";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { Notice, PageHeader } from "@/components/ui";
import { can, pageAdmin } from "@/server/auth";
import { getSite } from "@/server/settings";

export const metadata = { title: "Add vehicle" };

export default async function NewVehiclePage() {
  const admin = await pageAdmin("inventory");
  const [site, [{ n }]] = await Promise.all([getSite(), db.select({ n: sql<number>`count(*)::int` }).from(vehicles)]);
  return (
    <>
      <PageHeader title="Add vehicle" back={{ href: "/admin/vehicles", label: "Vehicles" }} />
      <div className="mb-6"><Notice tone="info">Photos are added on the next screen, right after the vehicle is created.</Notice></div>
      <VehicleForm initial={{ published: true }} canSeeCosts={can(admin, "finance")} featureSuggestions={site.featureSuggestions} suggestedStockNumber={`AM-${1001 + n}`} />
    </>
  );
}
