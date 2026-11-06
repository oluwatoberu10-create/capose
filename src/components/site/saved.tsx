"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useToast } from "@/components/toast";
import { toggleSavedOnAccount } from "@/server/actions/public";

/**
 * Saved listings live in localStorage so visitors never need an account.
 * Signed-in agents additionally get them stored on their account.
 */
const KEY = "am_saved";
const EVT = "am-saved-change";

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 100) : [];
  } catch {
    return [];
  }
}
let cache: string[] | null = null;
let cacheRaw: string | null = null;
function snapshot(): string[] {
  const raw = typeof window === "undefined" ? null : localStorage.getItem(KEY);
  if (cache && raw === cacheRaw) return cache;
  cacheRaw = raw;
  cache = read();
  return cache;
}
const EMPTY: string[] = [];
function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}

export function useSavedIds(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function setSaved(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify([...new Set(ids)].slice(0, 100)));
  window.dispatchEvent(new Event(EVT));
}

export function SaveButton({ vehicleId, variant = "icon", className = "" }: { vehicleId: string; variant?: "icon" | "full"; className?: string }) {
  const ids = useSavedIds();
  const saved = ids.includes(vehicleId);
  const push = useToast();
  const toggle = useCallback(() => {
    const next = saved ? ids.filter((x) => x !== vehicleId) : [...ids, vehicleId];
    setSaved(next);
    push(saved ? "Removed from saved cars" : "Saved — find it under the ♡ icon");
    void toggleSavedOnAccount(vehicleId, !saved).catch(() => {});
  }, [saved, ids, vehicleId, push]);

  const heart = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z" strokeLinejoin="round" /></svg>
  );
  if (variant === "full") {
    return (
      <button type="button" onClick={toggle} aria-pressed={saved} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition ${saved ? "border-gold/40 bg-gold-soft text-gold" : "border-line bg-white text-ink hover:border-ink/40"} ${className}`}>
        {heart}{saved ? "Saved" : "Save listing"}
      </button>
    );
  }
  return (
    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save car"}
      className={`grid size-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105 ${saved ? "text-gold" : "text-ink"} ${className}`}>
      {heart}
    </button>
  );
}

/** Copies the listing link, or opens the native share sheet on phones. Also offers WhatsApp sharing. */
export function ShareButton({ path, title, variant = "icon", className = "" }: { path: string; title: string; variant?: "icon" | "full"; className?: string }) {
  const push = useToast();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(path);
  useEffect(() => {
    // Agents sharing while signed in get their referral code appended automatically.
    const ref = localStorage.getItem("am_agent_code");
    const u = new URL(path, window.location.origin);
    if (ref) u.searchParams.set("ref", ref);
    setUrl(u.toString());
  }, [path]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      push("Link copied");
    } catch {
      push("Could not copy — long-press the address bar instead", "error");
    }
    setOpen(false);
  };
  const native = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, url }); setOpen(false); return; } catch { /* cancelled */ }
    }
    void copy();
  };
  const icon = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>;

  return (
    <div className={`relative ${className}`}>
      {variant === "full" ? (
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink hover:border-ink/40">{icon}Share</button>
      ) : (
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }} aria-label="Share car" className="grid size-9 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur transition hover:scale-105">{icon}</button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); }} />
          <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 text-sm shadow-lift" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="block w-full px-4 py-2.5 text-left hover:bg-mist" onClick={(e) => { e.preventDefault(); void copy(); }}>Copy link</button>
            <a className="block px-4 py-2.5 hover:bg-mist" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`} onClick={() => setOpen(false)}>Share on WhatsApp</a>
            <button type="button" className="block w-full px-4 py-2.5 text-left hover:bg-mist" onClick={(e) => { e.preventDefault(); void native(); }}>More options…</button>
          </div>
        </>
      )}
    </div>
  );
}
