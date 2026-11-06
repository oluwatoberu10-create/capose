"use client";
import { useEffect, useState } from "react";
import { EmptyState, LinkButton } from "@/components/ui";
import { savedCards } from "@/server/actions/public";
import type { VehicleCard } from "@/server/services/vehicles";
import { setSaved, useSavedIds } from "./saved";
import { VehicleGrid, VehicleGridSkeleton } from "./vehicle-card";

export function SavedList() {
  const ids = useSavedIds();
  const [cards, setCards] = useState<VehicleCard[] | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    let alive = true;
    savedCards(key ? key.split(",") : []).then(({ cards: c, accountIds }) => {
      if (!alive) return;
      // Pull account-saved cars into this device's list so the heart icons match.
      const missing = accountIds.filter((x) => !key.split(",").includes(x));
      if (missing.length) setSaved([...(key ? key.split(",") : []), ...missing]);
      const local = new Set([...(key ? key.split(",") : []), ...accountIds]);
      setCards(c.filter((x) => local.has(x.id)));
    }).catch(() => alive && setCards([]));
    return () => { alive = false; };
  }, [key]);

  if (cards === null) return <VehicleGridSkeleton count={4} />;
  if (!cards.length) return <EmptyState title="No saved cars yet" body="Tap the heart on any car to keep it here for later." action={<LinkButton href="/cars">Browse inventory</LinkButton>} />;
  return <VehicleGrid items={cards.filter((c) => ids.includes(c.id))} />;
}
