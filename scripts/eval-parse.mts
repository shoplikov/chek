/** npm run eval:parse — every sample image through the live parser; sum check and total accuracy. */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { parseReceipt } from "../lib/parse";
import { PARSE_MODEL, MATCH_MODEL, usage } from "../lib/llm";
import { listSamples } from "../lib/samples";

type Row = { id: string; sumCheck: boolean; totalOk: boolean; lines: string; ms: number };
const rows: Row[] = [];
for (const s of listSamples()) {
  const t = Date.now();
  const r = await parseReceipt(readFileSync(`public/samples/${s.file}`).toString("base64"), "image/jpeg", true);
  rows.push({ id: s.id, sumCheck: r.sumCheckPassed, totalOk: Math.abs(r.total - s.total) < 0.005, lines: `${r.lines.length}/${s.truth.length}`, ms: Date.now() - t });
}
// Optional real photos dropped into eval/real/ (not committed): reported separately, sum check only.
const real: Row[] = [];
if (existsSync("eval/real")) {
  for (const f of readdirSync("eval/real").filter(f => /\.(jpe?g|png|webp)$/i.test(f))) {
    const t = Date.now();
    try {
      const r = await parseReceipt(readFileSync(`eval/real/${f}`).toString("base64"), f.endsWith(".png") ? "image/png" : "image/jpeg", false);
      real.push({ id: f, sumCheck: r.sumCheckPassed, totalOk: false, lines: String(r.lines.length), ms: Date.now() - t });
    } catch (e) {
      real.push({ id: f, sumCheck: false, totalOk: false, lines: `error: ${(e as Error).message}`, ms: Date.now() - t });
    }
  }
}
console.table(rows);
const share = (xs: boolean[]) => `${xs.filter(Boolean).length}/${xs.length}`;
const median = rows.map(r => r.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)];
console.log(`Samples: sum check passed ${share(rows.map(r => r.sumCheck))}; parsed total equals known total ${share(rows.map(r => r.totalOk))}; median ${median} ms`);
if (real.length) {
  console.table(real);
  console.log(`Real photos: sum check passed ${share(real.map(r => r.sumCheck))}`);
}
console.log(`parse ${PARSE_MODEL}, match ${MATCH_MODEL}; tokens over ${usage.calls} calls: input ${usage.input} (cached ${usage.cachedInput}), output ${usage.output}`);
