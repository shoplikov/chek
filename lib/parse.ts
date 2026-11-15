import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { CONFIG } from "./config";
import { callJSON, imagePart, PARSE_MODEL } from "./llm";

/** PARSE_EFFORT=minimal|low|medium (default low) for the first read; the retry keeps the model default. */
const parseEffort = (): { model: string; effort?: "minimal" | "low" | "medium" } => {
  const e = process.env.PARSE_EFFORT;
  return { model: PARSE_MODEL, effort: e === "minimal" || e === "medium" ? e : "low" };
};
import type { Receipt, ReceiptLine } from "./types";

const ParsedReceipt = z.object({
  isReceipt: z.boolean(),
  store: z.object({ name: z.string(), city: z.string().nullable(), state: z.string().nullable() }),
  purchasedAt: z.string().nullable(),
  currency: z.string(),
  lines: z.array(z.object({
    line: z.number().int(), rawName: z.string(), qty: z.number(), unitPrice: z.number().nullable(),
    lineTotal: z.number(), discount: z.number(), taxable: z.boolean().nullable(),
  })),
  subtotal: z.number().nullable(), tax: z.number().nullable(), total: z.number(),
});
type Parsed = z.infer<typeof ParsedReceipt>;

export class NotAReceiptError extends Error {}

const cents = (n: number) => Math.round(n * 100);

/** Does the receipt add up? Pure; amounts compared in cents within the configured tolerance. */
export function sumCheck(r: Pick<Receipt, "lines" | "subtotal" | "tax" | "total">): { passed: boolean; itemsNet: number; detail: string } {
  const net = r.lines.reduce((s, l) => s + cents(l.lineTotal) - cents(Math.abs(l.discount)), 0);
  const tol = cents(CONFIG.SUM_CHECK_TOLERANCE_USD);
  const withTax = net + cents(r.tax ?? 0);
  const totalOk = Math.abs(withTax - cents(r.total)) <= tol;
  const subOk = r.subtotal != null && Math.abs(net - cents(r.subtotal)) <= tol;
  const detail = `items minus discounts = ${(net / 100).toFixed(2)}, plus tax ${(r.tax ?? 0).toFixed(2)} = ${(withTax / 100).toFixed(2)}; printed subtotal ${r.subtotal ?? "none"}, total ${r.total.toFixed(2)}`;
  return { passed: totalOk || subOk, itemsNet: net / 100, detail };
}

const prompt = () => readFileSync(join(process.cwd(), "prompts", "parse.md"), "utf8");

function toReceipt(p: Parsed, isSample: boolean): Omit<Receipt, "sumCheckPassed"> {
  const lines: ReceiptLine[] = p.lines.map((l, i) => ({
    line: i + 1, rawName: l.rawName.trim(), qty: l.qty > 0 ? l.qty : 1, unitPrice: l.unitPrice,
    lineTotal: l.lineTotal, discount: Math.abs(l.discount), taxable: l.taxable,
  }));
  const date = p.purchasedAt && /^\d{4}-\d{2}-\d{2}$/.test(p.purchasedAt) ? p.purchasedAt : null;
  return {
    id: randomUUID(), store: p.store, purchasedAt: date, currency: (p.currency || "USD").toUpperCase(),
    lines, subtotal: p.subtotal, tax: p.tax, total: p.total, isSample,
  };
}

/** One vision call; if the receipt does not add up, one retry with the mismatch stated. */
// ponytail: per-instance cache of transcriptions, keyed by the image bytes. The same photo gives the
// same lines (and the same headline), and re-scanning it costs no model call. Bounded; oldest out.
const parsed = new Map<string, Omit<Receipt, "id">>();
const imageKey = (b64: string, mime: string, isSample: boolean) =>
  createHash("sha256").update(`${mime}|${isSample}|`).update(b64).digest("hex");

/** True when this exact image was already transcribed on this instance (no model call needed). */
export const isParseCached = (b64: string, mime: string, isSample: boolean) => parsed.has(imageKey(b64, mime, isSample));

export async function parseReceipt(imageBase64: string, mime: string, isSample: boolean): Promise<Receipt> {
  const key = imageKey(imageBase64, mime, isSample);
  const hit = parsed.get(key);
  if (hit) return { ...structuredClone(hit), id: randomUUID() };
  const r = await parseReceiptUncached(imageBase64, mime, isSample);
  const { id: _id, ...rest } = r;
  parsed.set(key, structuredClone(rest));
  if (parsed.size > 300) parsed.delete(parsed.keys().next().value!);
  return r;
}

async function parseReceiptUncached(imageBase64: string, mime: string, isSample: boolean): Promise<Receipt> {
  const system = prompt();
  const image = imagePart(imageBase64, mime);
  const first = await callJSON(system, [image, { type: "text", text: "Transcribe this receipt." }], ParsedReceipt, "receipt", parseEffort());
  if (!first.isReceipt || first.lines.length === 0) throw new NotAReceiptError();
  let r = toReceipt(first, isSample);
  let check = sumCheck(r);
  if (!check.passed) {
    const retry = await callJSON(system, [
      image,
      { type: "text", text: `Transcribe this receipt. A previous transcription did not add up (${check.detail}). Re-read every line, discount and the totals carefully.` },
    ], ParsedReceipt, "receipt", { model: PARSE_MODEL });
    if (retry.isReceipt && retry.lines.length) {
      const r2 = toReceipt(retry, isSample);
      const c2 = sumCheck(r2);
      if (c2.passed) { r = r2; check = c2; }
    }
  }
  return { ...r, sumCheckPassed: check.passed };
}
