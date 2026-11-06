import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { DEFAULT_FEATURES } from "@/lib/constants";

/**
 * Dealership details shown across the public site. The defaults are
 * placeholders — replace them in Admin → Settings before going live.
 */
export type SiteSettings = {
  name: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  hours: string;
  instagram: string;
  facebook: string;
  x: string;
  tiktok: string;
  featureSuggestions: string[];
};

export const DEFAULT_SITE: SiteSettings = {
  name: "Aurum Motors",
  tagline: "Premium vehicles, honestly priced.",
  phone: "+234 800 000 0000",
  whatsapp: "+234 800 000 0000",
  email: "sales@example.com",
  address: "Plot 0, Admiralty Way, Lekki Phase 1, Lagos",
  hours: "Mon–Sat, 9:00am – 6:00pm",
  instagram: "",
  facebook: "",
  x: "",
  tiktok: "",
  featureSuggestions: DEFAULT_FEATURES,
};

export const getSite = cache(async (): Promise<SiteSettings> => {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "site")).limit(1);
    return { ...DEFAULT_SITE, ...((row?.value as Partial<SiteSettings>) ?? {}) };
  } catch {
    // Database unavailable (e.g. during a static build step): fall back to defaults.
    return DEFAULT_SITE;
  }
});

export async function saveSite(value: SiteSettings): Promise<void> {
  await db.insert(settings).values({ key: "site", value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** True while the contact details are still the shipped placeholders. */
export function isPlaceholderContact(s: SiteSettings): boolean {
  return s.phone === DEFAULT_SITE.phone || s.email === DEFAULT_SITE.email;
}
