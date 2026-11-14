"use client";
import { useState } from "react";
import Link from "next/link";
import { CONFIG } from "@/lib/config";
import { guaranteeCounter } from "@/lib/guarantee";
import { personalInflation } from "@/lib/inflation";
import { store } from "@/lib/store";
import { money } from "@/lib/util";
import type { Pledge, StoredReceipt } from "@/lib/types";
import { Badge, Button, Card, Spinner } from "./ui";
import { useStoreValue } from "./useStore";

const pct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const monthName = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const isDemo = (id: string) => id.startsWith("demo-");

export default function HistoryClient({ cpi, cpiId }: { cpi: { month: string; value: number }[]; cpiId: string }) {
  const receipts = useStoreValue(store.receipts);
  const pledges = useStoreValue(store.pledges);
  const unlocked = useStoreValue(store.unlocked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (receipts === undefined || pledges === undefined) return null;

  async function loadDemo() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/demo-history", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load the demo history.");
      const keep = store.receipts().filter(r => !isDemo(r.receipt.id));
      store.setReceipts([...keep, ...(json.receipts as StoredReceipt[])]);
      store.setPledges([...store.pledges().filter(p => !isDemo(p.id)), ...(json.pledges as Pledge[])]);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setLoading(false);
  }

  const sorted = [...receipts].sort((a, b) => (b.receipt.purchasedAt ?? b.scannedAt).localeCompare(a.receipt.purchasedAt ?? a.scannedAt));
  const allProven = receipts.flatMap(r => r.proven.map(p => ({ ...p, date: r.receipt.purchasedAt ?? r.scannedAt.slice(0, 10) })));
  const provenSum = allProven.reduce((s, p) => s + p.saving, 0);
  const counter = guaranteeCounter(receipts.map(r => ({ purchasedAt: r.receipt.purchasedAt, scannedAt: r.scannedAt, provenSaving: r.provenSaving, headlineSaving: r.headlineSaving })), new Date());
  const inflation = personalInflation(receipts.map(r => ({ receipt: r.receipt, matches: r.matches })), cpi);
  const byStore = new Map<string, Pledge[]>();
  for (const p of pledges) {
    const k = p.kind === "cheaper_elsewhere" ? p.targetStore ?? "Another store" : p.fromStore;
    byStore.set(k, [...(byStore.get(k) ?? []), p]);
  }
  const perPledge = pledges.map(p => {
    const items = allProven.filter(i => i.pledgeId === p.id).sort((a, b) => a.date.localeCompare(b.date));
    return { p, times: items.filter(i => i.status === "saved").length, paidMore: items.filter(i => i.status === "paid_more").length, amount: items.reduce((s, i) => s + i.saving, 0), last: items.at(-1)?.date };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Your history</h1>

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Switch list</h2>
          <span className="text-xs text-muted">Read this before your next shop</span>
        </div>
        {pledges.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Empty. On a result, tap <b>I&apos;ll switch next time</b> on a finding to add it here.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {[...byStore.entries()].map(([storeName, ps]) => (
              <div key={storeName}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">At {storeName}</div>
                <ul className="mt-1 divide-y divide-line">
                  {ps.map(p => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span>☐ {p.label} {p.isSample && <Badge tone="demo">{isDemo(p.id) ? "Demo" : "Sample"}</Badge>}</span>
                      <button onClick={() => store.removePledge(p.id)} className="text-xs text-muted underline shrink-0">Remove</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Proven savings</h2>
        <p className="mt-1 text-3xl font-semibold text-accent tabular">{money(provenSum)}</p>
        <p className="text-xs text-muted">What your switches actually saved, from your own receipts: price then vs price now.</p>
        {perPledge.length > 0 && (unlocked ? (
          <table className="mt-3 w-full text-sm tabular">
            <thead><tr className="text-left text-xs text-muted"><th className="font-normal py-1">Switch</th><th className="font-normal text-right">Proven</th><th className="font-normal text-right">Saved</th><th className="font-normal text-right">Last</th></tr></thead>
            <tbody>
              {perPledge.map(x => (
                <tr key={x.p.id} className="border-t border-line align-top">
                  <td className="py-1.5 pr-2">{x.p.label}{x.paidMore > 0 && <div className="text-xs text-warn">Cost more {x.paidMore}×</div>}</td>
                  <td className="text-right">{x.times}×</td><td className="text-right">{money(x.amount)}</td><td className="text-right text-xs text-muted">{x.last ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm"><Link href="/unlock" className="underline">Unlock</Link> to see the breakdown per switch.</p>
        ))}
      </Card>

      <Card className={counter.met ? "border-[#c4e6d6]" : ""}>
        <h2 className="font-semibold">This month&apos;s guarantee</h2>
        <p className="mt-1 text-sm">Proven savings this month: <b className="tabular">{money(counter.proven)}</b> of {money(counter.threshold)}. If we can&apos;t prove {money(counter.threshold)} in a month, that month is free.</p>
        <div className="mt-2 h-2 rounded-full bg-bg overflow-hidden"><div className="h-full bg-accent" style={{ width: `${Math.min(100, (counter.proven / counter.threshold) * 100)}%` }} /></div>
        <p className="mt-2 text-xs text-muted">Found on your receipts this month: <span className="tabular">{money(counter.found)}</span>. Found is what you could save; proven is what you did.</p>
      </Card>

      <Card>
        <h2 className="font-semibold">Your grocery inflation</h2>
        {!inflation.ok ? (
          <p className="mt-1 text-sm text-muted">Not enough history yet. Needs two receipts at least {CONFIG.INFLATION_MIN_DAYS} days apart with {CONFIG.INFLATION_MIN_COMMON_PRODUCTS}+ products in common.</p>
        ) : unlocked ? (
          <>
            <p className="mt-1 text-sm">Your groceries: <b className="tabular">{pct(inflation.personal)}</b> ({inflation.from} → {inflation.to}, {inflation.common} products bought both times).</p>
            {inflation.official
              ? <p className="text-sm">Official food-at-home inflation: <b className="tabular">{pct(inflation.official.change)}</b>, BLS {cpiId}, {monthName(inflation.official.fromMonth)}–{monthName(inflation.official.toMonth)}.</p>
              : <p className="text-sm text-muted">BLS has not published the official figure for these months yet.</p>}
          </>
        ) : (
          <p className="mt-1 text-sm">Your personal inflation is ready. <Link href="/unlock" className="underline">Unlock</Link> to see it next to the official BLS figure.</p>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Receipts ({receipts.length})</h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadDemo} disabled={loading}>{loading ? <><Spinner /> Running…</> : "Load 8 weeks of demo history"}</Button>
          </div>
        </div>
        {loading && <p className="mt-2 text-xs text-muted">Running 11 demo receipts through matching, findings and pledge checks. About 30 seconds.</p>}
        {error && <p className="mt-2 text-sm text-warn">{error}</p>}
        {sorted.length === 0 ? <p className="mt-2 text-sm text-muted">No receipts yet.</p> : (
          <ul className="mt-3 divide-y divide-line">
            {sorted.map(r => (
              <li key={r.receipt.id}>
                <Link href={`/result?id=${encodeURIComponent(r.receipt.id)}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-bg -mx-2 px-2 rounded-lg">
                  <span>
                    {r.receipt.store.name}{r.receipt.store.city ? `, ${r.receipt.store.city}` : ""} <span className="text-muted">· {r.receipt.purchasedAt ?? "no date"}</span>{" "}
                    {isDemo(r.receipt.id) ? <Badge tone="demo">Demo</Badge> : r.receipt.isSample ? <Badge>Sample</Badge> : null}
                  </span>
                  <span className="text-right tabular text-xs">
                    {money(r.receipt.total)}
                    {r.provenSaving > 0 && <span className="block text-accent">proven {money(r.provenSaving)}</span>}
                    {r.headlineSaving > 0 && <span className="block text-muted">found {money(r.headlineSaving)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {receipts.length > 0 && (
          <div className="mt-3 flex gap-2">
            {receipts.some(r => isDemo(r.receipt.id)) && <Button variant="ghost" onClick={() => store.clearDemo()}>Clear demo data</Button>}
            <Button variant="ghost" onClick={() => { if (confirm("Remove all receipts and your switch list from this browser?")) store.clearAll(); }}>Clear everything</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
