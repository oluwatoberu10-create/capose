import type { Metadata } from "next";
import { SavedList } from "@/components/site/saved-list";

export const metadata: Metadata = { title: "Saved cars" };

export default function SavedPage() {
  return (
    <div className="pt-24 pb-20 sm:pt-28">
      <div className="container-x">
        <p className="eyebrow">Your shortlist</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Saved cars</h1>
        <p className="mt-2 max-w-xl text-muted">Saved on this device — no account needed. Agents who are signed in also keep their saved cars on their account.</p>
        <div className="mt-8"><SavedList /></div>
      </div>
    </div>
  );
}
