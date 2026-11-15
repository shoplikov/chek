"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CONFIG } from "@/lib/config";
import { store } from "@/lib/store";
import { displayName, money } from "@/lib/util";
import type { Finding, Pledge, ProvenItem, StoredReceipt } from "@/lib/types";
import { Badge, Button, Card } from "@/components/ui";
import { useStoreValue } from "@/components/useStore";

const TYPE_LABEL: Record<Finding["type"], string> = {
  cheaper_elsewhere: "Cheaper at another store",
  cheaper_swap: "Cheaper similar product, same store",
  price_up: "Price went up since your last receipt",
  above_us_average: "Above the US average",
};

export default function ResultPage() {
  return <Suspense fallback={null}><Result /></Suspense>;
}

function Result() {
  const params = useSearchParams();
  const receipts = useStoreValue(store.receipts);
  const unlocked = useStoreValue(store.unlocked);
  const pledges = useStoreValue(store.pledges);
  if (receipts === undefined) return null;
  const id = params.get("id") ?? store.lastId();
  const r = receipts.find(x => x.receipt.id === id);
  if (!r) return (
    <Card><p>That receipt is not in this browser.</p><Link href="/" className="underline text-sm">Scan a receipt</Link></Card>
  );
  return <ResultView r={r} unlocked={!!unlocked} pledges={pledges ?? []} />;
}

function ResultView({ r, unlocked, pledges }: { r: StoredReceipt; unlocked: boolean; pledges: Pledge[] }) {
  const { receipt, findings, coverage } = r;
  const hidden = findings.slice(1);
  const hiddenSum = hidden.reduce((s, f) => s + f.savingOnThisReceipt, 0);
  const locked = !unlocked && hiddenSum >= CONFIG.PRICE_MONTHLY_USD;
  const matchedLines = new Set(r.matches.filter(m => m.reason === "matched").map(m => m.line));
  const unmatched = receipt.lines.filter(l => !matchedLines.has(l.line));
  const noData = !r.storeKnown || receipt.currency !== "USD";

  return (
    <div className="space-y-4">
      {r.proven.length > 0 && <ProvenBlock items={r.proven} total={r.provenSaving} />}

      <div className="slip-wrap">
        <div className="slip print-in px-4 sm:px-6 pt-4">
          <div className="flex items-start justify-between gap-3 font-mono text-[13px] text-muted">
            <div>
              <div className="font-semibold text-ink">{displayName(receipt.store.name)}{receipt.store.city ? `, ${displayName(receipt.store.city)}` : ""}</div>
              <div>{receipt.purchasedAt ?? "no date printed"} · {coverage.lines} lines</div>
            </div>
            {receipt.isSample && <Badge>Sample</Badge>}
          </div>
          <div className="mt-2 flex gap-2 font-mono text-[13px]">
            <span>TOTAL PAID</span><span className="leader" /><span className="tabular">{money(receipt.total)}</span>
          </div>
          <div className="my-4 border-t border-dashed border-line" />
          {noData ? (
            <>
              <h1 className="text-xl font-semibold">No price data for this store yet.</h1>
              <p className="mt-1 text-sm text-muted">Your history starts now. We read the receipt and saved it in this browser; the next receipt from this store can show price changes.</p>
              {r.headlineSaving > 0 && <p className="mt-3 text-sm">From your own history and US averages: <b className="tabular">{money(r.headlineSaving)}</b> worth checking below.</p>}
            </>
          ) : r.headlineSaving > 0 ? (
            <h1 className="text-[1.65rem] sm:text-3xl font-semibold leading-tight tracking-[-0.01em] text-balance">
              On this receipt you could have paid <span className="hl tabular">{money(r.headlineSaving)}</span> less.
            </h1>
          ) : (
            <h1 className="text-xl font-semibold">We found no savings on this receipt.</h1>
          )}
          <p className="mt-3 text-sm text-muted">
            Read {coverage.lines} lines, matched {coverage.matched} to products with price data, found savings on {coverage.withFinding}.
          </p>
          <p className={`mt-1 text-sm ${receipt.sumCheckPassed ? "text-accent" : "text-warn"}`}>
            {receipt.sumCheckPassed
              ? "✓ The lines add up to the printed total."
              : "Check these lines: the lines we read do not add up to the printed total, so only lines whose own math checks out are compared."}
          </p>
        </div>
      </div>

      {findings.length > 0 && (
        <div className="space-y-3">
          <FindingCard f={findings[0]} r={r} pledges={pledges} />
          {locked ? (
            <div className="relative">
              <div aria-hidden className="space-y-3 blur-sm select-none pointer-events-none">
                {hidden.slice(0, 3).map((f, i) => <FakeFinding key={i} f={f} />)}
              </div>
              <div className="absolute inset-0 grid place-items-center">
                <Card className="text-center shadow-[0_10px_30px_rgb(19_32_26/0.14)] max-w-sm">
                  <p className="font-semibold">{hidden.length} more finding{hidden.length > 1 ? "s" : ""} worth <span className="tabular">{money(hiddenSum)}</span></p>
                  <Link href="/unlock" className="mt-3 inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0d5734]">Unlock the rest — {money(CONFIG.PRICE_MONTHLY_USD)}/month</Link>
                  <p className="mt-2 text-xs text-muted">If we can&apos;t prove {money(CONFIG.GUARANTEE_THRESHOLD_USD)} of savings in a month, that month is free.</p>
                </Card>
              </div>
            </div>
          ) : (
            <>
              {hidden.map(f => <FindingCard key={`${f.line}-${f.type}`} f={f} r={r} pledges={pledges} />)}
              {!unlocked && hidden.length > 0 && <p className="text-xs text-muted text-center">Nothing here worth charging for. This one is free.</p>}
            </>
          )}
        </div>
      )}

      {r.notices.length > 0 && (
        <Card className="border-[#f0cfc3]">
          <h2 className="font-semibold">Worth a second look</h2>
          <p className="text-xs text-muted">Possibilities on the receipt itself. Not counted as savings.</p>
          <ul className="mt-2 space-y-1 text-sm">{r.notices.map((n, i) => <li key={i}>{n.text} <span className="text-muted tabular">({money(n.amountAtStake)} at stake)</span></li>)}</ul>
        </Card>
      )}

      <Card>
        <details>
          <summary className="cursor-pointer font-semibold">All {receipt.lines.length} lines we read{unmatched.length ? ` · ${unmatched.length} not matched` : ""}</summary>
          <table className="mt-3 w-full text-sm tabular">
            <tbody>
              {receipt.lines.map(l => (
                <tr key={l.line} className="border-t border-line">
                  <td className="py-1.5 pr-2 font-mono text-xs">{l.rawName}{l.qty !== 1 ? ` ×${l.qty}` : ""}</td>
                  <td className="py-1.5 pr-2 text-right">{money(l.lineTotal - l.discount)}</td>
                  <td className="py-1.5 text-right text-xs text-muted">{matchedLines.has(l.line) ? "matched" : "not matched"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {unmatched.length > 0 && <p className="mt-2 text-xs text-muted">Lines we could not match to a product with price data are shown but not compared. We prefer no match to a wrong one.</p>}
        </details>
      </Card>

      <div className="flex gap-2">
        <Link href="/" className="flex-1 text-center rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium hover:border-ink/30">Scan another</Link>
        <Link href="/history" className="flex-1 text-center rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium hover:border-ink/30">History &amp; switch list</Link>
      </div>
    </div>
  );
}

function ProvenBlock({ items, total }: { items: ProvenItem[]; total: number }) {
  return (
    <Card className="border-[#c3e2cf] bg-accent-soft">
      <h2 className="text-lg font-semibold">Proven on this receipt: <span className="hl tabular">{money(total)}</span> saved</h2>
      <p className="text-xs text-muted">From what you paid before and what you paid now. No reference prices used.</p>
      <ul className="mt-3 space-y-2">
        {items.map(i => (
          <li key={i.pledgeId} className="rounded-lg bg-card border border-line p-3 text-sm">
            <div className="font-medium">{i.label}</div>
            <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-muted tabular">
              <div>Then: <b className="text-ink">{money(i.then.price)}</b> {i.then.unit ?? "each"}<br />Your receipt, {displayName(i.then.sourceLabel.replace(/^Your receipt, /, ""))}, {i.then.observedAt}</div>
              <div>Now: <b className="text-ink">{money(i.now.price)}</b> {i.now.unit ?? "each"}<br />line “{i.now.productName}”, {i.now.observedAt}</div>
            </div>
            <div className={`mt-1 text-sm font-medium ${i.status === "saved" ? "text-accent" : "text-warn"}`}>
              {i.status === "saved" ? `Saved ${money(i.saving)}` : `This switch cost you ${money(i.extraPaid)} more this time`}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FakeFinding({ f }: { f: Finding }) {
  return <Card><div className="h-4 w-2/3 rounded bg-line" /><div className="mt-2 h-3 w-1/2 rounded bg-line" /><div className="mt-2 text-sm">{TYPE_LABEL[f.type]}</div></Card>;
}

function FindingCard({ f, r, pledges }: { f: Finding; r: StoredReceipt; pledges: Pledge[] }) {
  const [open, setOpen] = useState(false);
  const line = r.receipt.lines.find(l => l.line === f.line);
  const pledgeId = `${r.receipt.id}:${f.line}:${f.type}`;
  const pledged = pledges.some(p => p.id === pledgeId);
  const canPledge = (f.type === "cheaper_swap" || f.type === "cheaper_elsewhere") && !!f.productCode;
  const ev = f.evidence;

  function toggle() {
    if (pledged) return store.removePledge(pledgeId);
    const p: Pledge = {
      id: pledgeId,
      // A pledge counts from the date of the receipt it was made on.
      createdAt: r.receipt.purchasedAt ?? new Date().toISOString().slice(0, 10),
      fromReceiptId: r.receipt.id, isSample: r.receipt.isSample,
      kind: f.type as Pledge["kind"], productCode: f.productCode!,
      targetProductCode: f.type === "cheaper_swap" ? f.targetProductCode! : f.productCode!,
      categoryTag: f.categoryTag ?? null, fromStore: r.receipt.store.name, targetStore: f.targetStore ?? null,
      paidPrice: f.paid, paidUnitPrice: f.paidUnit, expectedSaving: f.savingOnThisReceipt,
      label: f.type === "cheaper_swap" ? `Switch to ${f.targetName}` : `Buy ${f.productName ?? line?.rawName} at ${f.targetStore}`,
    };
    if (!store.addPledge(p)) alert(`Your switch list is full (${CONFIG.PLEDGE_MAX_ACTIVE}). Remove one on History first.`);
  }

  return (
    <Card>
      <button onClick={() => setOpen(!open)} className="w-full text-left" aria-expanded={open}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium text-accent">{TYPE_LABEL[f.type]}</div>
            <div className="mt-1 font-mono text-xs text-muted">{line?.rawName}</div>
            <p className="mt-1 text-sm leading-snug">{f.headline}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-semibold tabular"><span className="hl">{money(f.savingOnThisReceipt)}</span></div>
            <div className="mt-1 text-xs text-muted underline decoration-dotted underline-offset-2">{open ? "Hide proof" : "Show proof"}</div>
          </div>
        </div>
      </button>
      {open && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-dashed border-line bg-[#f6f7f5] p-3 text-xs">
          <dt className="text-muted">Source</dt>
          <dd>{ev.sourceType === "open_prices" ? "Open Prices observation" : ev.sourceType === "bls" ? "BLS average price" : "Your earlier receipt"}</dd>
          <dt className="text-muted">Where</dt><dd>{ev.sourceLabel}</dd>
          {ev.productName && <><dt className="text-muted">Product</dt><dd>{ev.productName}</dd></>}
          <dt className="text-muted">Price</dt><dd className="tabular">{money(ev.price)}{ev.unit ? ` (${ev.unit})` : ""}</dd>
          <dt className="text-muted">{ev.sourceType === "bls" ? "Month" : "Observed"}</dt><dd>{ev.observedAt}</dd>
          <dt className="text-muted">Reference</dt>
          <dd className="break-all">{ev.url ? <a href={ev.url} target="_blank" rel="noreferrer" className="underline">{ev.sourceRef}</a> : ev.sourceRef}</dd>
          {f.type === "above_us_average" && <dd className="col-span-2 text-muted">US city average; BLS has no city-level prices and warns against place-to-place comparison.</dd>}
        </dl>
      )}
      {canPledge && (
        <div className="mt-3">
          <Button variant={pledged ? "secondary" : "ghost"} onClick={toggle} className={pledged ? "border-accent text-accent bg-accent-soft" : "border border-ink/20"}>
            {pledged ? "✓ On your switch list" : "I'll switch next time"}
          </Button>
        </div>
      )}
    </Card>
  );
}
