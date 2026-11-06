import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicleAcquisitions } from "@/db/schema";
import { AcquisitionForm } from "@/components/admin/acquisition-form";
import { ConfirmAction } from "@/components/form";
import { PageHeader } from "@/components/ui";
import { deleteAcquisition } from "@/server/actions/admin-crm";
import { pageAdmin } from "@/server/auth";
import { vehicleOptions } from "@/server/services/vehicles";

export const metadata = { title: "Acquisition" };

export default async function EditAcquisition({ params }: { params: Promise<{ id: string }> }) {
  await pageAdmin("finance");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [[a], vehicles] = await Promise.all([db.select().from(vehicleAcquisitions).where(eq(vehicleAcquisitions.id, id)).limit(1), vehicleOptions()]);
  if (!a) notFound();
  return (
    <>
      <PageHeader title={`${a.year} ${a.brand} ${a.model}`} subtitle="Acquisition record" back={{ href: "/admin/crm/acquisitions", label: "Acquisitions" }}
        actions={<ConfirmAction action={deleteAcquisition} fields={{ id: a.id }} label="Delete" confirmTitle="Delete this acquisition record?" confirmBody="Existing sales keep the acquisition cost they recorded. The linked listing's internal cost falls back to its previous acquisition record, if any." confirmLabel="Delete record" />} />
      <AcquisitionForm key={a.updatedAt.toISOString()} vehicles={vehicles} initial={a} />
    </>
  );
}
