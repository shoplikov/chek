import { z } from "zod";
import { CONFIG } from "@/lib/config";
import { clientIp, MESSAGES, rateLimited } from "@/lib/guard";
import { LlmError } from "@/lib/llm";
import { NotAReceiptError, parseReceipt } from "@/lib/parse";
import { sampleImage } from "@/lib/samples";
import { analyse } from "@/lib/scan";
import type { Match, Pledge, Receipt } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (status: number, error: string) => Response.json({ error }, { status });

// Client-supplied history and pledges are only used for comparisons with the user's own data.
const History = z.array(z.object({ receipt: z.custom<Receipt>(v => !!v && typeof v === "object"), matches: z.array(z.custom<Match>()) })).max(CONFIG.MAX_HISTORY_RECEIPTS);
const Pledges = z.array(z.custom<Pledge>(v => !!v && typeof v === "object")).max(CONFIG.PLEDGE_MAX_ACTIVE);

export async function POST(req: Request) {
  if (rateLimited(clientIp(req))) return fail(429, MESSAGES.rate);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > CONFIG.MAX_IMAGE_BYTES + 1_000_000) return fail(413, MESSAGES.tooBig);

  let image: { base64: string; mime: string } | null = null;
  let isSample = false;
  let historyRaw: unknown = [], pledgesRaw: unknown = [];
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("image");
      if (!(file instanceof File)) return fail(400, MESSAGES.badRequest);
      if (file.size > CONFIG.MAX_IMAGE_BYTES) return fail(413, MESSAGES.tooBig);
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return fail(400, MESSAGES.notReceipt);
      image = { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mime: file.type };
      historyRaw = JSON.parse(String(form.get("history") ?? "[]"));
      pledgesRaw = JSON.parse(String(form.get("pledges") ?? "[]"));
    } else {
      const body = await req.json();
      image = sampleImage(String(body.sampleId ?? ""));
      if (!image) return fail(400, MESSAGES.badRequest);
      isSample = true;
      historyRaw = body.history ?? []; pledgesRaw = body.pledges ?? [];
    }
  } catch {
    return fail(400, MESSAGES.badRequest);
  }
  const history = History.safeParse(historyRaw), pledges = Pledges.safeParse(pledgesRaw);
  if (!history.success || !pledges.success) return fail(400, MESSAGES.badRequest);

  try {
    const receipt = await parseReceipt(image.base64, image.mime, isSample);
    const result = await analyse(receipt, history.data, pledges.data);
    return Response.json(result);
  } catch (e) {
    if (e instanceof NotAReceiptError) return fail(422, MESSAGES.notReceipt);
    console.error("scan failed", e instanceof LlmError ? e.message : e);
    return fail(502, MESSAGES.llm);
  }
}
