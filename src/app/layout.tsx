import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { getSite } from "@/server/settings";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap", axes: ["wdth"] });

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  return {
    title: { default: `${site.name} — ${site.tagline}`, template: `%s · ${site.name}` },
    description: `Browse premium brand new and foreign used cars at ${site.name}. Transparent Naira pricing, full specifications and easy ordering.`,
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  };
}

export const viewport: Viewport = { themeColor: "#0b0b0c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" className={`${inter.variable} ${archivo.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
