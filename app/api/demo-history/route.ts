import { clientIp, MESSAGES, rateLimited } from "@/lib/guard";
import { demoHistory } from "@/lib/samples";
import { analyse, type HistoryItem } from "@/lib/scan";
import type { StoredReceipt } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Runs the DEMO household's receipts through the live pipeline (matching, findings, pledge
 * verification) in date order, as if they had been scanned week by week. The receipts are
 * stored as parsed JSON, so no images are read; everything else is the same code as a scan.
 */
export async function POST(req: Request) {
  if (rateLimited(clientIp(req))) return Response.json({ error: MESSAGES.rate }, { status: 429 });
  try {
    const { receipts, pledges } = demoHistory();
    const sorted = [...receipts].sort((a, b) => (a.purchasedAt ?? "").localeCompare(b.purchasedAt ?? ""));
    const history: HistoryItem[] = [];
    const out: StoredReceipt[] = [];
    // In date order, so each receipt sees the ones before it (lines repeat, so the match cache helps).
    const results = [];
    for (const r of sorted) {
      const res = await analyse(r, history.slice(-20), pledges);
      history.push({ receipt: res.receipt, matches: res.matches });
      results.push(res);
    }
    for (const res of results) out.push({ ...res, scannedAt: new Date().toISOString() });
    return Response.json({ receipts: out, pledges });
  } catch (e) {
    console.error("demo history failed", e);
    return Response.json({ error: "Could not load the demo history. Try again." }, { status: 502 });
  }
}
