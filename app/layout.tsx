import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chek: see where you overpaid on groceries",
  description: "Photograph a grocery receipt. See where you overpaid, with a cited source for every number.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f5f1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${mono.variable} min-h-screen flex flex-col`}>
        <header className="border-b border-line bg-card/80 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg tracking-tight">Chek<span className="text-accent">.</span></Link>
            <div className="flex gap-1 text-sm">
              <Link href="/" className="px-3 py-2 rounded-lg hover:bg-bg">Scan</Link>
              <Link href="/history" className="px-3 py-2 rounded-lg hover:bg-bg">History</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-2xl px-4 py-6 flex-1">{children}</main>
        <footer className="border-t border-line text-xs text-muted">
          <div className="mx-auto max-w-2xl px-4 py-5 space-y-1">
            <p>
              Price data: <a className="underline" href="https://prices.openfoodfacts.org" target="_blank" rel="noreferrer">Open Prices (Open Food Facts)</a>, ODbL.
              US averages: <a className="underline" href="https://www.bls.gov" target="_blank" rel="noreferrer">U.S. Bureau of Labor Statistics</a>.
            </p>
            <p>No sign-up. Your receipts stay in this browser. Photos are not stored on our server.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
