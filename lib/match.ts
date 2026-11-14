import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CONFIG } from "./config";
import type { Catalog, Product } from "./catalog";
import { callJSON } from "./llm";
import { paidPrice } from "./findings";
import type { Match, Receipt, ReceiptLine } from "./types";

/** Candidate search in code; the model only picks among candidates; guards in code. */

const tokenize = (s: string) =>
  s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9%.]+/g, " ").split(" ").filter(t => t.length >= 2);

/** "spnch" abbreviates "spinach": same first letter, letters appear in order. */
export function abbreviates(raw: string, word: string): boolean {
  if (!raw || !word || raw[0] !== word[0] || raw.length > word.length) return false;
  let i = 0;
  for (const ch of word) if (ch === raw[i]) i++;
  return i === raw.length;
}

function tokenScore(raw: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    if (w === raw) return 1;
    if (raw.length >= 2 && w.startsWith(raw)) best = Math.max(best, 0.9);
    else if (raw.length >= 3 && abbreviates(raw, w)) best = Math.max(best, 0.7);
  }
  return best;
}

const productWords = new WeakMap<Product, string[]>();
const wordsOf = (p: Product) => {
  let w = productWords.get(p);
  if (!w) productWords.set(p, (w = tokenize(`${p.name} ${p.brands ?? ""} ${p.quantityText ?? ""}`)));
  return w;
};

export function candidates(c: Catalog, rawName: string, storeLocationIds: number[], limit = CONFIG.MATCH_CANDIDATES): Product[] {
  const raw = tokenize(rawName).filter(t => !/^\d+(\.\d+)?$/.test(t));
  if (raw.length === 0) return [];
  const atStore = new Set<string>();
  for (const id of storeLocationIds) for (const o of c.pricesByLocation.get(id) ?? []) atStore.add(o.productCode);
  const scored: { p: Product; s: number }[] = [];
  for (const p of c.products.values()) {
    const words = wordsOf(p);
    let s = 0;
    for (const t of raw) s += tokenScore(t, words);
    if (s === 0) continue;
    s = s / raw.length + (atStore.has(p.code) ? 0.3 : 0);
    scored.push({ p, s });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.p);
}

const Pick = z.object({
  lines: z.array(z.object({ line: z.number().int(), choice: z.number().int().nullable(), confidence: z.number() })),
});

const describe = (c: Catalog, p: Product, storeLocationIds: number[]) => {
  const here = (c.pricesByProduct.get(p.code) ?? []).find(o => storeLocationIds.includes(o.locationId));
  return `${p.name}${p.brands ? ` | brand: ${p.brands}` : ""}${p.quantityText ? ` | size: ${p.quantityText}` : ""}${here ? ` | price at this store: $${here.price.toFixed(2)} (${here.date})` : ""}`;
};

/** Price guard: reject when the paid price is >3x or <1/3 of every reference price for the product. */
export function priceGuardOk(c: Catalog, l: ReceiptLine, code: string): boolean {
  const refs = c.pricesByProduct.get(code) ?? [];
  if (refs.length === 0) return false;
  const paid = paidPrice(l);
  const r = CONFIG.PRICE_GUARD_RATIO;
  return refs.some(o => paid <= o.price * r && paid >= o.price / r);
}

/** Apply the code-side guards to the model's picks. Pure. */
export function applyGuards(
  c: Catalog, lines: ReceiptLine[], cands: Map<number, Product[]>,
  picks: { line: number; choice: number | null; confidence: number }[],
): Match[] {
  return lines.map(l => {
    const list = cands.get(l.line) ?? [];
    if (list.length === 0) return { line: l.line, productCode: null, confidence: 0, reason: "no_candidate" as const };
    const pick = picks.find(p => p.line === l.line);
    const chosen = pick?.choice != null ? list[pick.choice - 1] : undefined; // must be one of this line's candidates
    const confidence = Math.max(0, Math.min(1, pick?.confidence ?? 0));
    if (!chosen) return { line: l.line, productCode: null, confidence, reason: "no_candidate" as const };
    if (confidence < CONFIG.MATCH_MIN_CONFIDENCE) return { line: l.line, productCode: null, confidence, reason: "low_confidence" as const };
    if (!priceGuardOk(c, l, chosen.code)) return { line: l.line, productCode: null, confidence, reason: "price_guard" as const };
    return { line: l.line, productCode: chosen.code, confidence, reason: "matched" as const };
  });
}

// ponytail: per-instance cache keyed by (store, rawName); fine for one container.
const cache = new Map<string, Match & { cachedPaid: number }>();
const cacheKey = (store: string, raw: string) => `${store.trim().toLowerCase()}|${raw.trim().toUpperCase()}`;

export async function matchReceipt(c: Catalog, r: Receipt, storeLocationIds: number[]): Promise<Match[]> {
  const out = new Map<number, Match>();
  const todo: ReceiptLine[] = [];
  for (const l of r.lines) {
    const hit = cache.get(cacheKey(r.store.name, l.rawName));
    if (hit) {
      const m: Match = { line: l.line, productCode: hit.productCode, confidence: hit.confidence, reason: hit.reason };
      if (m.productCode && !priceGuardOk(c, l, m.productCode)) { m.productCode = null; m.reason = "price_guard"; }
      out.set(l.line, m);
    } else todo.push(l);
  }
  if (todo.length) {
    const cands = new Map(todo.map(l => [l.line, candidates(c, l.rawName, storeLocationIds)]));
    const withCands = todo.filter(l => cands.get(l.line)!.length);
    let picks: z.infer<typeof Pick>["lines"] = [];
    if (withCands.length) {
      const body = withCands.map(l => {
        const unit = l.unitPrice != null && l.qty !== 1 ? `, ${l.qty} x ${l.unitPrice}` : "";
        const list = cands.get(l.line)!.map((p, i) => `  ${i + 1}. ${describe(c, p, storeLocationIds)}`).join("\n");
        return `Line ${l.line}: "${l.rawName}" paid $${paidPrice(l).toFixed(2)} each${unit}\nCandidates:\n${list}`;
      }).join("\n\n");
      const system = readFileSync(join(process.cwd(), "prompts", "match.md"), "utf8");
      const res = await callJSON(system, `Store: ${r.store.name}${r.store.city ? `, ${r.store.city}` : ""}\n\n${body}\n\nFor each line, \`choice\` is the candidate number or null.`, Pick, "matches", { effort: "low" });
      picks = res.lines;
    }
    for (const m of applyGuards(c, todo, cands, picks)) {
      out.set(m.line, m);
      const l = todo.find(x => x.line === m.line)!;
      if (m.reason !== "price_guard") cache.set(cacheKey(r.store.name, l.rawName), { ...m, cachedPaid: paidPrice(l) });
    }
  }
  return r.lines.map(l => out.get(l.line)!);
}

