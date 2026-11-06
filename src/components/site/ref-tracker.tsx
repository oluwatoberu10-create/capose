"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps a copy of the referral code in localStorage (a backup for the cookie
 * set by middleware) and logs one visit per code per browser session.
 */
export function RefTracker() {
  const params = useSearchParams();
  const path = usePathname();
  useEffect(() => {
    const code = params.get("ref")?.trim().toUpperCase();
    if (!code || !/^[A-Z0-9]{4,16}$/.test(code)) return;
    try {
      localStorage.setItem("am_ref", JSON.stringify({ code, at: Date.now() }));
      const key = `am_ref_logged_${code}_${path}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* storage disabled */ }
    void fetch("/api/referral-visit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, path }) }).catch(() => {});
  }, [params, path]);
  return null;
}

/** Reads the stored referral code (if still within 90 days). */
export function storedRef(): string {
  try {
    const v = JSON.parse(localStorage.getItem("am_ref") ?? "null") as { code: string; at: number } | null;
    if (v && Date.now() - v.at < 90 * 864e5) return v.code;
  } catch { /* ignore */ }
  return "";
}
