"use client";
import { CONFIG } from "./config";
import type { Match, Pledge, Receipt, StoredReceipt } from "./types";

/** Everything the user has lives in this browser's localStorage. No accounts, no server copy. */
const K = { receipts: "chek.receipts.v1", pledges: "chek.pledges.v1", unlocked: "chek.unlocked.v1", last: "chek.last.v1" };

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked: keep going */ }
  window.dispatchEvent(new Event("chek-store"));
}

export const store = {
  receipts: () => read<StoredReceipt[]>(K.receipts, []),
  saveReceipt(r: StoredReceipt) {
    const all = store.receipts().filter(x => x.receipt.id !== r.receipt.id);
    all.push(r);
    write(K.receipts, all);
    write(K.last, r.receipt.id);
  },
  setReceipts: (rs: StoredReceipt[]) => write(K.receipts, rs),
  lastId: () => read<string | null>(K.last, null),
  setLast: (id: string) => write(K.last, id),
  pledges: () => read<Pledge[]>(K.pledges, []),
  addPledge(p: Pledge) {
    const all = store.pledges().filter(x => x.id !== p.id);
    if (all.length >= CONFIG.PLEDGE_MAX_ACTIVE) return false;
    write(K.pledges, [...all, p]);
    return true;
  },
  removePledge: (id: string) => write(K.pledges, store.pledges().filter(p => p.id !== id)),
  setPledges: (ps: Pledge[]) => write(K.pledges, ps),
  unlocked: () => read<boolean>(K.unlocked, false),
  // ponytail: client-side flag; fine for a demo with no real money.
  setUnlocked: (v: boolean) => write(K.unlocked, v),
  /** What a scan sends back to the server: earlier receipts with their matches. */
  historyForScan(): { receipt: Receipt; matches: Match[] }[] {
    return store.receipts()
      .sort((a, b) => (a.receipt.purchasedAt ?? a.scannedAt).localeCompare(b.receipt.purchasedAt ?? b.scannedAt))
      .slice(-CONFIG.MAX_HISTORY_RECEIPTS)
      .map(r => ({ receipt: r.receipt, matches: r.matches }));
  },
  clearAll() { for (const k of Object.values(K)) try { localStorage.removeItem(k); } catch {} window.dispatchEvent(new Event("chek-store")); },
  clearDemo() {
    write(K.receipts, store.receipts().filter(r => !r.receipt.isSample || !r.receipt.id.startsWith("demo-")));
    write(K.pledges, store.pledges().filter(p => !p.id.startsWith("demo-")));
  },
};
