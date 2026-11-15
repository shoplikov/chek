import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const ui = Schibsted_Grotesk({ variable: "--font-ui", subsets: ["latin"] });
const receipt = IBM_Plex_Mono({ variable: "--font-receipt", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "Chek: see where you overpaid on groceries",
  description: "Photograph a grocery receipt. See where you overpaid, with a cited source for every number.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#e8ebe7" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${ui.variable} ${receipt.variable} min-h-screen flex flex-col`}>
        <header className="border-b border-line bg-bg/85 backdrop-blur sticky top-0 z-10">
          <nav className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between">
            <Link href="/" className="font-mono font-semibold text-lg tracking-tight" aria-label="Chek home"><span className="hl">Chek</span></Link>
            <div className="flex gap-1 text-sm">
              <Link href="/" className="px-3 py-2 rounded-lg hover:bg-card">Scan</Link>
              <Link href="/history" className="px-3 py-2 rounded-lg hover:bg-card">History</Link>
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
