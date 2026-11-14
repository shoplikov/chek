"use client";
import { store } from "@/lib/store";
import type { ScanResult, StoredReceipt } from "@/lib/types";

/** Downsize a photo to at most 1600 px on the long side, as JPEG, before upload. */
export async function downsize(file: File, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((res) => canvas.toBlob(b => res(b ?? file), "image/jpeg", 0.85));
}

async function handle(res: Response): Promise<StoredReceipt> {
  const json = await res.json().catch(() => ({ error: "Something went wrong reading this receipt. Nothing was saved. Try again." }));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong reading this receipt. Nothing was saved. Try again.");
  const stored: StoredReceipt = { ...(json as ScanResult), scannedAt: new Date().toISOString() };
  store.saveReceipt(stored);
  return stored;
}

export async function scanSample(sampleId: string) {
  return handle(await fetch("/api/scan", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sampleId, history: store.historyForScan(), pledges: store.pledges() }),
  }));
}

export async function scanFile(file: File) {
  const blob = await downsize(file);
  const form = new FormData();
  form.append("image", blob, "receipt.jpg");
  form.append("history", JSON.stringify(store.historyForScan()));
  form.append("pledges", JSON.stringify(store.pledges()));
  return handle(await fetch("/api/scan", { method: "POST", body: form }));
}
