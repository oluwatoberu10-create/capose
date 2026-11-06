import { AcquisitionForm } from "@/components/admin/acquisition-form";
import { PageHeader } from "@/components/ui";
import { pageAdmin } from "@/server/auth";
import { vehicleOptions } from "@/server/services/vehicles";

export const metadata = { title: "Record acquisition" };

export default async function NewAcquisition({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  await pageAdmin("finance");
  const [{ vehicle }, vehicles] = await Promise.all([searchParams, vehicleOptions()]);
  const v = vehicles.find((x) => x.id === vehicle);
  return (
    <>
      <PageHeader title="Record acquisition" back={{ href: "/admin/crm/acquisitions", label: "Acquisitions" }} />
      <AcquisitionForm vehicles={vehicles} initial={v ? { vehicleId: v.id, brand: v.brand, model: v.model, year: v.year, stockNumber: v.stockNumber } : {}} />
    </>
  );
}
