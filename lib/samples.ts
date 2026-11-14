import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pledge, Receipt } from "./types";

export type SampleMeta = { id: string; title: string; subtitle: string; file: string; store: string; total: number; truth: { line: number; productCode: string | null }[] };

const read = <T,>(f: string) => JSON.parse(readFileSync(join(process.cwd(), "data", f), "utf8")) as T;

export const listSamples = () => read<{ samples: SampleMeta[] }>("samples.json").samples;

export function sampleImage(id: string): { base64: string; mime: string } | null {
  const s = listSamples().find(x => x.id === id);
  if (!s) return null;
  return { base64: readFileSync(join(process.cwd(), "public", "samples", s.file)).toString("base64"), mime: "image/jpeg" };
}

export const demoHistory = () => read<{ receipts: Receipt[]; pledges: Pledge[] }>("demo-history.json");
