"use client";
import { useState } from "react";
import { InlineAction } from "@/components/form";
import { btn } from "@/components/ui";
import { quickVehicleUpdate } from "@/server/actions/admin-vehicles";

/** "⋯" menu with the quick status changes for one vehicle. */
export function VehicleQuickActions({ id, featured, published, override }: { id: string; featured: boolean; published: boolean; override: boolean }) {
  const [open, setOpen] = useState(false);
  const ops: [string, string][] = [
    ["available", "Mark available"], ["reserved", "Mark reserved"], ["sold", "Mark sold"], ["out_of_stock", "Mark out of stock"],
    ...(override ? [["auto", "Follow stock automatically"] as [string, string]] : []),
    [featured ? "unfeature" : "feature", featured ? "Remove from featured" : "Feature on homepage"],
    [published ? "unpublish" : "publish", published ? "Hide from website" : "Publish on website"],
  ];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={btn("ghost", "sm", "px-2.5")} aria-label="More actions" aria-expanded={open}>⋯</button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-56 rounded-xl border border-line bg-white p-1.5 shadow-lift">
            {ops.map(([op, label]) => (
              <InlineAction key={op} action={quickVehicleUpdate} fields={{ id, op }} variant="ghost" size="sm" className="block w-full [&_button]:w-full [&_button]:justify-start" onDone={() => setOpen(false)}>{label}</InlineAction>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
