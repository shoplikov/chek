import { CONFIG } from "./config";

// ponytail: per-instance memory; the hard limit is the spend cap on the LLM key.
const hits = new Map<string, number[]>();

export function rateLimited(ip: string, now = Date.now()): boolean {
  const windowMs = CONFIG.RATE_LIMIT.windowMinutes * 60_000;
  const list = (hits.get(ip) ?? []).filter(t => now - t < windowMs);
  if (list.length >= CONFIG.RATE_LIMIT.scans) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  return false;
}

export const clientIp = (req: Request) =>
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";

export const MESSAGES = {
  notReceipt: "We couldn't read a receipt in this photo. Try a flatter, brighter shot, or use a sample.",
  llm: "Something went wrong reading this receipt. Nothing was saved. Try again.",
  rate: "Too many scans from this network. Try again in a few minutes.",
  tooBig: "That photo is too large. Try a smaller one (under 4 MB).",
  badRequest: "We couldn't understand that request.",
};
