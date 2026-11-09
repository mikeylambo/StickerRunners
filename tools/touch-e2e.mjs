#!/usr/bin/env node
/**
 * Headless touch E2E (gate). Run after `vite build`. Emulates an iPhone 13 in portrait and landscape
 * (Playwright device descriptors on Chromium) and drives everything by touch only:
 *  1. Shell flow by tap: Title → Menu → Mode → ribbon running.
 *  2. Pause button tap → Pause screen → tap Resume.
 *  3. Hold → drag → release over the first gap (s 300–314): peel, steer, slap with ≥ 90% speed kept.
 *  4. Quick upward flick = Kick-off and never a peel. Horizontal drag = steer while stuck, no peel.
 *  5. Finish (autopilot) → Results → tap Retry → back on the ribbon.
 * Real touch events go in through CDP Input.dispatchTouchEvent (→ pointer events, pointerType "touch").
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { preview } from "vite";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); }
catch { console.error("touch: Playwright not found. Install it globally or `npm i -D playwright` (and its browsers)."); process.exit(1); }
const { chromium, devices } = pw;

const outDir = path.resolve("artifacts/touch");
fs.mkdirSync(outDir, { recursive: true });
let failed = false;
const fail = (tag, msg) => { console.error(`touch[${tag}]: FAIL — ${msg}`); failed = true; };
const ok = (tag, msg) => console.log(`touch[${tag}]: ok — ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = await preview({ preview: { port: 0, strictPort: false }, logLevel: "silent" });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function runDevice(tag, deviceName) {
  const ctx = await browser.newContext({ ...devices[deviceName] });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  pg.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  const cdp = await ctx.newCDPSession(pg);
  const touch = async (type, x, y) => {
    await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }] });
    await sleep(15);
  };
  const G = (fn, arg) => pg.evaluate(fn, arg);
  const events = () => G(() => window.__GAME.events());
  const vp = pg.viewportSize();
  const cx = Math.round(vp.width / 2); const cy = Math.round(vp.height * 0.55);

  try {
    await pg.goto(`${url}?step`);
    await pg.waitForFunction(() => !!window.__GAME, null, { timeout: 20000 });
    if (await G(() => !!document.getElementById("sr-error"))) fail(tag, "error overlay visible at boot");

    // 1 — Shell flow by tap only
    await pg.tap('[data-choice-id="start"]');
    await pg.tap('[data-choice-id="play"]');
    const mode = await G(() => document.querySelector("[data-choice-id]")?.getAttribute("data-choice-id"));
    await pg.tap(`[data-choice-id="${mode}"]`);
    await pg.waitForFunction(() => window.__GAME.game.running, null, { timeout: 5000 }).catch(() => {});
    let st = await G(() => window.__GAME.step(90));
    if (!st.running || st.s < 10) fail(tag, `tap flow did not start the ribbon: ${JSON.stringify(st)}`);
    else ok(tag, `Title → Menu → Mode (${mode}) by tap; ribbon running`);
    const portrait = await G(() => window.__GAME.game.portrait);
    ok(tag, `camera ${portrait ? "portrait" : "landscape"} for ${vp.width}×${vp.height}`);
    const hint = await G(() => document.getElementById("sr-hint").textContent);
    if (!/HOLD.*LET GO/.test(hint)) fail(tag, `touch hint not shown: "${hint}"`); else ok(tag, "touch hint shown");

    // 2 — pause button
    if (!(await pg.isVisible("#sr-pause"))) fail(tag, "pause button not visible while playing");
    await pg.tap("#sr-pause");
    const paused = await G(() => ({ p: window.__GAME.game.paused, ui: !!document.querySelector('[data-screen-id="pause"]') }));
    if (!paused.p || !paused.ui) fail(tag, `pause button did not pause: ${JSON.stringify(paused)}`);
    await pg.tap('[data-choice-id="resume"]');
    if (await G(() => window.__GAME.game.paused)) fail(tag, "resume tap did not resume"); else ok(tag, "pause button → Pause → Resume by tap");

    // 3 — hold → drag → release over the first gap
    await G(() => window.__GAME.place(286, 0));
    await G(() => window.__GAME.step(1, undefined));
    const before = (await events()).length;
    await touch("touchStart", cx, cy);
    let peelTick = -1;
    for (let i = 0; i < 12; i++) { st = await G(() => window.__GAME.step(1)); if (st.state === "peeled") { peelTick = i + 1; break; } }
    if (peelTick < 0) fail(tag, `hold did not peel: ${JSON.stringify(st)}`); else ok(tag, `hold → peeled after ${peelTick} ticks`);
    await touch("touchMove", cx + 22, cy);
    const lat0 = st.lat;
    let guard = 0;
    while (st.s < 317 && guard++ < 200) st = await G(() => window.__GAME.step(1));
    if (st.state !== "peeled") fail(tag, `not peeled over the gap at s=${st.s}: ${st.state}`);
    if (!(st.lat > lat0 + 0.3)) fail(tag, `drag right did not steer while peeled (lat ${lat0} → ${st.lat})`); else ok(tag, `drag steered while peeled (lat ${lat0.toFixed(2)} → ${st.lat.toFixed(2)})`);
    await pg.screenshot({ path: path.join(outDir, `${tag}-peeled-over-gap.png`) });
    await touch("touchEnd");
    st = await G(() => window.__GAME.step(8));
    const ev = (await events()).slice(before);
    const slap = ev.find((e) => e.type === "slap");
    if (!slap) fail(tag, `release over road did not slap: ${ev.map((e) => e.type).join(",")}`);
    else {
      const keep = slap.exitSpeed / slap.entrySpeed;
      if (keep < 0.9) fail(tag, `slap kept ${keep}`); else ok(tag, `release → slap on ${slap.surface} at s=${slap.s.toFixed(1)}, kept ${(keep * 100).toFixed(1)}% speed`);
    }
    if (ev.some((e) => e.type === "fall" || e.type === "whiff")) fail(tag, "fell or whiffed over the gap");
    await pg.screenshot({ path: path.join(outDir, `${tag}-slap.png`) });

    // 4a — flick up = kick-off, not peel
    await G(() => { window.__GAME.place(100, 0); window.__GAME.step(6); });
    let n0 = (await events()).length;
    await touch("touchStart", cx, cy);
    await touch("touchMove", cx, cy - 20);
    await touch("touchMove", cx, cy - 45);
    await touch("touchEnd");
    await G(() => window.__GAME.step(10));
    let e2 = (await events()).slice(n0).map((e) => e.type);
    if (!e2.includes("kick")) fail(tag, `flick did not kick: ${e2.join(",")}`);
    else if (e2.includes("peel")) fail(tag, `flick also peeled: ${e2.join(",")}`);
    else ok(tag, "flick up → kick-off, no peel");

    // 4b — horizontal drag = steer while stuck, no peel
    await G(() => { window.__GAME.place(140, 0); window.__GAME.step(30); });
    n0 = (await events()).length;
    const latA = (await G(() => window.__GAME.state)).lat;
    await touch("touchStart", cx, cy);
    await touch("touchMove", cx - 20, cy);
    await touch("touchMove", cx - 45, cy);
    st = await G(() => window.__GAME.step(12)); // ~1.5 m at full steer: stays on the 6 m ribbon
    await touch("touchEnd");
    e2 = (await events()).slice(n0).map((e) => e.type);
    if (e2.includes("peel") || st.state !== "stuck") fail(tag, `steer-drag peeled: ${e2.join(",")} ${st.state}`);
    else if (!(st.lat < latA - 1)) fail(tag, `drag left did not steer (lat ${latA} → ${st.lat})`);
    else ok(tag, `drag left while stuck → steer (lat ${latA.toFixed(2)} → ${st.lat.toFixed(2)}), no peel`);

    // 5 — finish → results → tap Retry
    await G(() => window.__GAME.setAutopilot(true));
    st = await G(() => window.__GAME.run(60 * 150, 600));
    await G(() => window.__GAME.setAutopilot(false));
    if (!(await G(() => !!document.querySelector('[data-screen-id="results"]')))) fail(tag, `results not shown: ${JSON.stringify(st)}`);
    else ok(tag, `ribbon finished (${st.time}s) → results`);
    await pg.screenshot({ path: path.join(outDir, `${tag}-results.png`) });
    await pg.tap('[data-choice-id="retry"]');
    await pg.waitForFunction(() => window.__GAME.game.running, null, { timeout: 5000 }).catch(() => {});
    st = await G(() => window.__GAME.step(30));
    if (!st.running || st.s > 40) fail(tag, `retry tap did not restart: ${JSON.stringify(st)}`); else ok(tag, "Retry by tap → back on the ribbon");
    if (await G(() => !!document.getElementById("sr-error") && document.getElementById("sr-error").style.display !== "none")) {
      fail(tag, `error overlay: ${await G(() => document.getElementById("sr-error").textContent)}`);
    }
  } catch (e) {
    fail(tag, e instanceof Error ? e.stack ?? e.message : String(e));
  } finally {
    if (errors.length) fail(tag, `page errors:\n  ${errors.join("\n  ")}`);
    await ctx.close();
  }
}

try {
  await runDevice("portrait", "iPhone 13");
  await runDevice("landscape", "iPhone 13 landscape");
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
if (failed) process.exit(1);
console.log(`touch: PASS (screenshots in ${path.relative(process.cwd(), outDir)}/)`);
