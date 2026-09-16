import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CadastOps",
  description: "Cadastral lot verification — surfaces, distances, bornes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${ibmPlexMono.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-paper text-ink antialiased">
        <header className="no-print title-block border-b sticky top-0 z-20">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link href="/lots" className="font-heading text-xl tracking-tight">
              CadastOps
            </Link>
            <nav className="flex gap-6 text-sm uppercase tracking-wide">
              <Link href="/lots" className="hover:text-copper">
                Lots
              </Link>
              <Link href="/map" className="hover:text-copper">
                Carte
              </Link>
              <Link href="/lots/new" className="hover:text-copper">
                Nouveau lot
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
