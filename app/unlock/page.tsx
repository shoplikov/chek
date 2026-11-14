"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONFIG } from "@/lib/config";
import { store } from "@/lib/store";
import { money } from "@/lib/util";
import { Button, Card, Spinner } from "@/components/ui";
import { useStoreValue } from "@/components/useStore";

const TEST_CARD = "4242 4242 4242 4242";

export default function UnlockPage() {
  const router = useRouter();
  const unlocked = useStoreValue(store.unlocked);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState(""); const [exp, setExp] = useState(""); const [cvc, setCvc] = useState("");

  async function checkout() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Checkout is unavailable right now.");
      if (json.mode === "stripe" && json.url) { window.location.href = json.url; return; }
      setDemo(true);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  function payDemo(e: React.FormEvent) {
    e.preventDefault();
    if (card.replace(/\s/g, "") !== TEST_CARD.replace(/\s/g, "")) return setError(`Use the test card ${TEST_CARD}.`);
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(exp) || !/^\d{3,4}$/.test(cvc)) return setError("Enter any future expiry (MM/YY) and any 3-digit CVC.");
    store.setUnlocked(true);
    router.push("/unlock/success?demo=1");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Chek Plus</h1>
      <Card>
        <p className="text-3xl font-semibold tabular">{money(CONFIG.PRICE_MONTHLY_USD)}<span className="text-base font-normal text-muted">/month</span></p>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li>✓ Every finding on every receipt, each with its source</li>
          <li>✓ Proven savings broken down per switch</li>
          <li>✓ Your personal grocery inflation next to the official BLS figure</li>
          <li>✓ Guarantee: if we can&apos;t prove {money(CONFIG.GUARANTEE_THRESHOLD_USD)} of savings in a month, that month is free</li>
        </ul>
        <p className="mt-3 text-xs text-muted">Free forever: the headline amount, the first finding with its proof, your switch list and the proven total.</p>
      </Card>

      {unlocked ? (
        <Card className="border-[#c4e6d6] bg-accent-soft"><p className="font-medium">You&apos;re unlocked in this browser.</p></Card>
      ) : !demo ? (
        <Card>
          <p className="text-sm">Test mode: no real money moves. Pay with the test card:</p>
          <p className="mt-2 rounded-xl bg-bg px-3 py-2 font-mono text-lg tracking-wider text-center">{TEST_CARD}</p>
          <p className="mt-1 text-xs text-muted text-center">any future expiry · any CVC · any ZIP</p>
          <Button onClick={checkout} disabled={busy} className="mt-4 w-full">{busy ? <Spinner /> : null} Continue to checkout</Button>
        </Card>
      ) : (
        <Card>
          <h2 className="font-semibold">Demo checkout — no real payment</h2>
          <p className="text-xs text-muted">Stripe is not configured on this deployment, so this form stands in for it. Nothing is charged and no card data leaves this page.</p>
          <form onSubmit={payDemo} className="mt-3 space-y-2">
            <label className="block text-sm">Card number
              <input value={card} onChange={e => setCard(e.target.value)} inputMode="numeric" placeholder={TEST_CARD} autoComplete="off"
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-mono" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">Expiry<input value={exp} onChange={e => setExp(e.target.value)} placeholder="12/30" autoComplete="off" className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-mono" /></label>
              <label className="block text-sm">CVC<input value={cvc} onChange={e => setCvc(e.target.value)} placeholder="123" inputMode="numeric" autoComplete="off" className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-mono" /></label>
            </div>
            <Button type="submit" className="w-full">Pay {money(CONFIG.PRICE_MONTHLY_USD)} (test)</Button>
            <button type="button" className="w-full text-xs text-muted underline" onClick={() => { setCard(TEST_CARD); setExp("12/30"); setCvc("123"); }}>Fill in the test card</button>
          </form>
        </Card>
      )}
      {error && <p role="alert" className="rounded-xl border border-[#f1d9b8] bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
    </div>
  );
}
