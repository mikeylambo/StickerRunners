#!/usr/bin/env node
// Headless lookdev capture: every material on every subject, every VFX at peak, stress + voidglass bench.
// Writes artifacts/lookdev/*.png, contact-sheet.html and report.json. SwiftShader numbers are NOT hardware numbers.
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const root = process.cwd();
const site = path.join(root, "artifacts", "lookdev-build");
const out = path.join(root, "artifacts", "lookdev");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
function findChrome() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  for (const n of ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser"]) { const f = spawnSync("which", [n], { encoding: "utf8" }); if (f.status === 0 && f.stdout.trim()) return f.stdout.trim(); }
  for (const c of ["/opt/pw-browsers/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]) if (fs.existsSync(c)) {
    if (fs.statSync(c).isDirectory()) { const f = spawnSync("bash", ["-c", `ls -d ${c}/*/chrome-linux*/chrome 2>/dev/null | head -1`], { encoding: "utf8" }).stdout.trim(); if (f) return f; } else return c;
  }
  throw new Error("Chrome not found; set CHROME_BIN");
}
const server = http.createServer(async (req, res) => {
  try { const u = new URL(req.url, "http://x"); const f = path.resolve(site, decodeURIComponent(u.pathname).replace(/^\/+/, "") || "index.html");
    if (!f.startsWith(site)) throw 0; const s = await fsp.stat(f); if (!s.isFile()) throw 0;
    res.writeHead(200, { "content-type": mime[path.extname(f)] ?? "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const userData = await fsp.mkdtemp(path.join(os.tmpdir(), "slu-lookdev-"));
const chrome = spawn(findChrome(), ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--remote-debugging-port=0", `--user-data-dir=${userData}`, "--window-size=960,540", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
let id = 0; const pending = new Map(); const errors = [];
try {
  let port; for (let i = 0; i < 200 && !port; i++) { try { port = Number((await fsp.readFile(path.join(userData, "DevToolsActivePort"), "utf8")).split("\n")[0]); } catch { await sleep(100); } }
  let target; for (let i = 0; i < 100 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch {} if (!target) await sleep(100); }
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.j(new Error(m.error.message)) : p.r(m.result); } else if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text); else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ")); };
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; pending.set(i, { r, j }); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = async (expr) => { const o = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (o.exceptionDetails) throw new Error(o.exceptionDetails.exception?.description ?? o.exceptionDetails.text); return o.result.value; };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${origin}/index.html?capture=1` });
  for (let i = 0; i < 200; i++) { if (await evaluate("!!window.__lookdev").catch(() => false)) break; await sleep(100); }
  await fsp.rm(out, { recursive: true, force: true }); await fsp.mkdir(out, { recursive: true });
  const shots = []; const only = process.env.LOOKDEV_ONLY; // quick iteration: filter shots, skip perf
  const want = (label) => !only || label.includes(only);
  const snap = async (name, label) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    const buf = Buffer.from(data, "base64"); await fsp.writeFile(path.join(out, name), buf);
    // pixel sanity: sample center region via page for black / NaN-white frames
    const s = await evaluate(`(()=>{const c=document.getElementById('view');const g=c.getContext('webgl2');const w=g.drawingBufferWidth,h=g.drawingBufferHeight;const p=new Uint8Array(4*64);let sum=0,white=0,n=0;for(let i=0;i<64;i++){g.readPixels(Math.floor(w*(0.2+0.6*((i%8)/7))),Math.floor(h*(0.2+0.6*(Math.floor(i/8)/7))),1,1,g.RGBA,g.UNSIGNED_BYTE,p.subarray(i*4,i*4+4));}for(let i=0;i<64;i++){const r=p[i*4],gg=p[i*4+1],b=p[i*4+2];sum+=r+gg+b;if(r>250&&gg>250&&b>250)white++;n++;}return{mean:sum/(n*3),white:white/n}})()`);
    shots.push({ name, label, ...s }); process.stdout.write(".");
  };
  const L = "window.__lookdev";
  const api = await evaluate(`({materials:${L}.materials,subjects:${L}.subjects,vfx:${L}.vfx,bundles:${L}.bundles})`);
  await evaluate(`${L}.setCamera(1)`);
  for (const subject of api.subjects) for (const material of api.materials) {
    if (!want(`${material} · ${subject}`)) continue;
    await evaluate(`${L}.setSubject(${JSON.stringify(subject)});${L}.setMaterial(${JSON.stringify(material)});${L}.step(1/60,4);${L}.render()`);
    await snap(`mat_${material}_${subject}.png`.replace(/[^\w.-]/g, "_"), `${material} · ${subject}`);
  }
  await evaluate(`${L}.setSubject('humanoid');${L}.setMaterial('slu.lit');${L}.setCamera(0)`);
  for (const fx of api.vfx.filter(want)) { await evaluate(`${L}.playVfxAtPeak(${JSON.stringify(fx)})`); await snap(`vfx_${fx}.png`.replace(/[^\w.-]/g, "_"), fx); }
  for (const b of api.bundles.filter((b) => want(`feel ${b}`))) { await evaluate(`${L}.clearVfx();${L}.feelImpact(${JSON.stringify(b)});${L}.step(1/60,5);${L}.render()`); await snap(`feel_${b}.png`.replace(/[^\w.-]/g, "_"), `feel ${b}`); }
  await evaluate(`${L}.hideDummy();${L}.clearVfx();${L}.setCamera(3)`);
  if (only) { console.log(`\n${shots.length} shots (LOOKDEV_ONLY=${only}); perf skipped`); ws.close(); process.exit(0); }
  console.log("\nstress…");
  const stress = await evaluate(`${L}.stress(${Number(process.env.LOOKDEV_STRESS_FRAMES ?? 60)})`);
  await evaluate(`${L}.step(1/60,1);${L}.render()`);
  const bench = {};
  for (const m of ["slu.voidglass", "slu.voidglass.ss"]) bench[m] = await evaluate(`${L}.bench(${JSON.stringify(m)},24,${Number(process.env.LOOKDEV_BENCH_FRAMES ?? 40)})`);
  const bad = shots.filter((s) => s.mean < 3 || s.white > 0.5);
  const report = { renderer: "headless Chrome + SwiftShader (CPU) at 960x540 — not hardware numbers", stress, voidglassBench: bench, shots: shots.length, suspect: bad, errors };
  await fsp.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await fsp.writeFile(path.join(out, "contact-sheet.html"), `<!doctype html><meta charset="utf-8"><title>SLU lookdev contact sheet</title>
<style>body{background:#07061a;color:#e8ecff;font:12px system-ui;margin:16px}div{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}figure{margin:0}img{width:100%;border-radius:6px;border:1px solid #2a2f52}figcaption{opacity:.8;padding:2px}.bad img{border-color:#ff3b5c}pre{white-space:pre-wrap}</style>
<h1>SLU lookdev</h1><pre>${JSON.stringify({ stress, voidglassBench: bench }, null, 1)}</pre><div>${shots.map((s) => `<figure class="${bad.includes(s) ? "bad" : ""}"><img src="${s.name}" loading="lazy"><figcaption>${s.label}</figcaption></figure>`).join("")}</div>`);
  console.log(JSON.stringify({ shots: shots.length, suspect: bad.map((b) => b.label), errors: errors.slice(0, 5), stress, bench }, null, 1));
  if (errors.length || bad.length) process.exitCode = 1;
  ws.close();
} finally { chrome.kill("SIGKILL"); server.close(); await fsp.rm(userData, { recursive: true, force: true }).catch(() => {}); }
