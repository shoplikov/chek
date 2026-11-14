/** npm run smoke -- <url>: scan a sample on a deployed URL and check health. */
const base = (process.argv[2] ?? "https://54-163-135-214.nip.io").replace(/\/$/, "");
const fail = (m: string) => { console.error("FAIL:", m); process.exit(1); };

const h = await (await fetch(`${base}/api/health`)).json();
if (!h.ok || !(h.products > 0)) fail(`health ${JSON.stringify(h)}`);
console.log("health", h);

type F = { savingOnThisReceipt: number; evidence?: { sourceRef?: string } };
const t = Date.now();
const res = await fetch(`${base}/api/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sampleId: "week1" }) });
const r = await res.json();
if (!res.ok) fail(`scan ${res.status} ${JSON.stringify(r)}`);
const findings: F[] = r.findings ?? [];
if (!findings.length) fail("no findings");
if (!findings.every(f => f.evidence?.sourceRef)) fail("finding without evidence");
const sum = Math.round(findings.reduce((s, f) => s + f.savingOnThisReceipt, 0) * 100) / 100;
if (sum !== r.headlineSaving) fail(`headline ${r.headlineSaving} != sum ${sum}`);
console.log(`scan ok in ${Date.now() - t} ms: ${findings.length} findings, headline $${r.headlineSaving}, sum check ${r.receipt.sumCheckPassed}`);
