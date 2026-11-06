import Link from "next/link";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink px-6 text-center text-white">
      <div>
        <p className="eyebrow !text-gold-bright">404</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">This page has driven off.</h1>
        <p className="mt-3 text-white/60">The car or page you&apos;re looking for isn&apos;t here — it may have been sold or moved.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/cars" className={btn("gold", "lg")}>Browse inventory</Link>
          <Link href="/" className={btn("light", "lg")}>Home</Link>
        </div>
      </div>
    </div>
  );
}
