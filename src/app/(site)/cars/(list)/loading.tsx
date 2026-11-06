import { VehicleGridSkeleton } from "@/components/site/vehicle-card";

export default function Loading() {
  return (
    <>
      <section className="bg-ink pt-28 pb-10 sm:pt-32 sm:pb-14"><div className="container-x"><div className="h-3 w-24 rounded bg-white/10" /><div className="mt-4 h-10 w-72 rounded bg-white/10" /></div></section>
      <section className="container-x py-10"><div className="skeleton mb-6 h-12 w-full" /><VehicleGridSkeleton /></section>
    </>
  );
}
