"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Badge, Card, Spinner } from "./ui";
import { scanFile, scanSample } from "./scanClient";

type Sample = { id: string; title: string; subtitle: string; file: string };

export default function HomeClient({ samples }: { samples: Sample[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ receipt: { id: string } }>) {
    setBusy(key); setError(null);
    try {
      const r = await fn();
      router.push(`/result?id=${encodeURIComponent(r.receipt.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-[2rem] sm:text-[2.6rem] font-semibold tracking-[-0.02em] leading-[1.08] text-balance">
          Your grocery receipt knows where you overpaid.
        </h1>
        <p className="mt-3 max-w-prose text-muted">
          Photograph it. Chek reads every line and checks it against real shelf prices at nearby stores, your past
          receipts and US averages. Every number comes with its source.
        </p>
      </div>

      <figure className="slip-wrap" aria-label="Example from the Week 1 sample receipt">
        <div className="slip px-4 pt-3 font-mono text-[13px] leading-6">
          <div className="flex gap-2 text-muted"><span>FLGRS CLSSC ROAST</span><span className="leader" /><span className="tabular">6.99</span></div>
          <div className="flex gap-2"><span className="hl">OCEAN CRSNS DRIED</span><span className="leader" /><span className="tabular hl">7.49</span></div>
          <div className="flex gap-2 text-muted"><span>CLSSC RSTD GRLC PA</span><span className="leader" /><span className="tabular">3.99</span></div>
          <figcaption className="mt-2 border-t border-dashed border-line pt-2 font-sans text-sm leading-snug text-ink">
            Mariani dried cranberries cost $0.70 per 100 g on the same shelf. You paid $1.32.{" "}
            <b className="text-accent tabular">$3.50 back next time.</b>
          </figcaption>
        </div>
      </figure>

      <div>
        <input ref={input} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) run("upload", () => scanFile(f)); }} />
        <button onClick={() => input.current?.click()} disabled={!!busy}
          className="w-full rounded-xl bg-accent text-white py-4 text-base font-semibold flex items-center justify-center gap-2 hover:bg-[#0d5734] active:translate-y-px disabled:opacity-60">
          {busy === "upload" ? <><Spinner /> Reading your receipt…</> : "Scan a receipt"}
        </button>
        {busy && <p className="mt-2 text-center text-xs text-muted">Reading the receipt, matching products and checking prices. This takes about 10 seconds.</p>}
        {error && <p role="alert" className="mt-3 rounded-xl border border-[#f0cfc3] bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold">No receipt handy? Try a sample</h2>
          <span className="text-xs text-muted">Same live pipeline</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {samples.map(s => (
            <button key={s.id} disabled={!!busy} onClick={() => run(s.id, () => scanSample(s.id))}
              className="group text-left rounded-xl border border-line bg-card overflow-hidden hover:border-ink/40 disabled:opacity-60">
              <div className="relative h-28 bg-[#cfd4cf] overflow-hidden">
                <Image src={`/samples/${s.file}`} alt={`Sample receipt: ${s.title}`} fill sizes="200px" loading="eager" className="object-cover object-top opacity-90 group-hover:opacity-100" />
                <span className="absolute left-2 top-2"><Badge>Sample</Badge></span>
                {busy === s.id && <span className="absolute inset-0 grid place-items-center bg-black/40 text-white"><Spinner /></span>}
              </div>
              <div className="p-2.5">
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-[11px] text-muted leading-snug">{s.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Card>
        <h2 className="font-semibold">For the jury: the full loop in four taps</h2>
        <ol className="mt-2 space-y-1.5 text-sm list-decimal pl-5">
          <li>Tap the sample <b>Week 1</b>.</li>
          <li>Tap <b>I&apos;ll switch next time</b> on two findings, and unlock the rest with the test card.</li>
          <li>Tap the sample <b>Week 2 (follow-up)</b> to see what those switches actually saved.</li>
          <li>On <a href="/history" className="underline">History</a>, load 8 weeks of demo history.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">
          We have price data for stores in Mountain View, Sunnyvale and Los Altos, California. Other stores: your receipt
          is read and saved, and comparisons start when data exists.
        </p>
      </Card>
    </div>
  );
}
