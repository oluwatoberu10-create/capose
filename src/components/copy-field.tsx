"use client";
import { useState } from "react";
import { btn } from "@/components/ui";
import { useToast } from "@/components/toast";

export function CopyField({ value, label, dark }: { value: string; label?: string; dark?: boolean }) {
  const push = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      push("Copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      push("Copy failed — select the text and copy it manually", "error");
    }
  };
  return (
    <div>
      {label && <p className={`mb-1.5 text-[12px] ${dark ? "text-white/50" : "text-muted"}`}>{label}</p>}
      <div className="flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} aria-label={label ?? "Link"} className={`${dark ? "field-dark" : "field"} min-w-0 flex-1 font-mono text-[13px]`} />
        <button type="button" onClick={copy} className={btn(dark ? "gold" : "primary", "md", "shrink-0")}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

/** Builds a referral link for any listed car. */
export function CarLinkBuilder({ base, code, cars }: { base: string; code: string; cars: { slug: string; title: string }[] }) {
  const [slug, setSlug] = useState("");
  const url = `${base}${slug ? `/cars/${slug}` : "/cars"}?ref=${code}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`Check out ${slug ? cars.find((c) => c.slug === slug)?.title : "these cars"}: ${url}`)}`;
  return (
    <div className="space-y-3">
      <select aria-label="Choose a car" className="field" value={slug} onChange={(e) => setSlug(e.target.value)}>
        <option value="">Whole inventory</option>
        {cars.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
      </select>
      <CopyField value={url} />
      <a href={wa} target="_blank" rel="noopener noreferrer" className={btn("gold", "md", "w-full sm:w-auto")}>Share on WhatsApp</a>
    </div>
  );
}
