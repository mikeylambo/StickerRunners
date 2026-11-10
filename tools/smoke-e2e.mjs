#!/usr/bin/env node
/**
 * Headless E2E smoke (gate): builds nothing itself — run after `vite build`.
 *  1. Shell flow by keyboard: Title → Menu → Mode → ribbon is running.
 *  2. ?quick&step&bot: the autopilot runs the whole ribbon start → end through the real page
 *     (sim + renderer + Shell), with zero fall-outs and every slap ≥ 90% speed.
 *  3. Results screen appears; Retry puts you straight back on the ribbon.
 * Screenshots → artifacts/smoke/. Exits non-zero on any failure or page error.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { preview } from "vite";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { console.error("smoke: Playwright not found. Install it globally or `npm i -D playwright` (and its browsers)."); process.exit(1); }

const outDir = path.resolve("artifacts/smoke");
fs.mkdirSync(outDir, { recursive: true });
const fail = (msg) => { console.error(`smoke: FAIL — ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`smoke: ok — ${msg}`);

const server = await preview({ preview: { port: 0, strictPort: false }, logLevel: "silent" });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
const newPage = async () => {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  pg.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  return pg;
};

try {
  // 1 — Shell flow by keyboard
  {
    const pg = await newPage();
    await pg.goto(`${url}?step`);
    await pg.waitForFunction(() => !!window.__GAME, null, { timeout: 20000 });
    for (let i = 0; i < 6; i++) {
      if (await pg.evaluate(() => window.__GAME.game.running)) break;
      await pg.keyboard.press("Enter");
      await pg.waitForTimeout(250);
    }
    const st = await pg.evaluate(() => window.__GAME.step(120, {}));
    if (!st.running || st.s < 20) fail(`menu flow did not start the ribbon: ${JSON.stringify(st)}`);
    else ok(`Title → Menu → Mode → ribbon running (s=${st.s})`);
    await pg.close();
  }

  // 2 — autopilot runs the ribbon start → end
  const pg = await newPage();
  await pg.goto(`${url}?quick&step&bot`);
  await pg.waitForFunction(() => !!window.__GAME && window.__GAME.game.running, null, { timeout: 20000 });
  await pg.screenshot({ path: path.join(outDir, "01-start.png") });
  let st = await pg.evaluate(() => window.__GAME.step(60 * 25));
  await pg.screenshot({ path: path.join(outDir, "02-midrun.png") });
  st = await pg.evaluate(() => window.__GAME.run(60 * 150, 300));
  const pixels = await pg.evaluate(() => {
    const c = document.getElementById("game-canvas");
    const k = document.createElement("canvas"); k.width = 64; k.height = 36;
    const g = k.getContext("2d"); g.drawImage(c, 0, 0, 64, 36);
    const d = g.getImageData(0, 0, 64, 36).data; let lit = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++;
    return lit;
  });
  const s = st.stats;
  if (!st.finished) fail(`did not reach the finish: ${JSON.stringify(st)}`);
  else ok(`ribbon completed in ${st.time}s sim time (${s.slaps} slaps, ${s.peels} peels, ${s.kicks} kick-offs)`);
  if (s.falls !== 0) fail(`autopilot fell out ${s.falls}×`); else ok("no fall-outs");
  if (!(s.slaps >= 5)) fail(`expected ≥5 slaps, got ${s.slaps}`);
  if (!(s.minSlapKeep >= 0.9)) fail(`a slap kept only ${s.minSlapKeep} of entry speed`); else ok(`min slap keep ${s.minSlapKeep}`);
  if (pixels < 40) fail(`canvas looks blank (${pixels} lit samples)`); else ok(`canvas rendered (${pixels}/2304 lit samples)`);

  // 3 — results → retry
  const results = await pg.evaluate(() => !!document.querySelector('[data-screen-id="results"]'));
  await pg.screenshot({ path: path.join(outDir, "03-results.png") });
  if (!results) fail("results screen not shown"); else ok("results screen shown");
  await pg.click('[data-choice-id="retry"]');
  await pg.waitForFunction(() => window.__GAME.game.running, null, { timeout: 5000 }).catch(() => {});
  const again = await pg.evaluate(() => window.__GAME.step(60));
  if (!again.running || again.s > 60) fail(`retry did not restart the ribbon: ${JSON.stringify(again)}`);
  else ok("retry → back on the ribbon");

  // 4 — Phase 0c web section (?stage=web): the bot runs the safe line, then the fast line, in the real page
  const times = {};
  for (const line of ["safe", "fast"]) {
    const wp = await newPage();
    await wp.goto(`${url}?quick&step&bot&stage=web&line=${line}`);
    await wp.waitForFunction(() => !!window.__GAME && window.__GAME.game.running, null, { timeout: 20000 });
    const ws = await wp.evaluate(() => window.__GAME.run(60 * 60, 300));
    const w = ws.stats;
    times[line] = ws.time;
    if (!ws.finished) fail(`web ${line}: did not finish: ${JSON.stringify(ws)}`);
    else ok(`web ${line} line: finished in ${ws.time}s sim (${w.slaps} slaps, ${w.peels} peels, ${w.kicks} kick-offs)`);
    if (w.falls !== 0) fail(`web ${line}: fell out ${w.falls}×`);
    if (!(w.minSlapKeep >= 0.9)) fail(`web ${line}: a slap kept only ${w.minSlapKeep}`); else ok(`web ${line}: no falls, min slap keep ${w.minSlapKeep}`);
    await wp.screenshot({ path: path.join(outDir, `04-web-${line}-results.png`) });
    await wp.close();
  }
  if (times.fast && times.safe) {
    const gain = 1 - times.fast / times.safe;
    if (gain < 0.15) fail(`web: fast line only ${(gain * 100).toFixed(1)}% quicker`); else ok(`web: fast line ${(gain * 100).toFixed(1)}% quicker than safe`);
  }
} catch (e) {
  fail(e instanceof Error ? e.stack ?? e.message : String(e));
} finally {
  if (errors.length) fail(`page errors:\n  ${errors.join("\n  ")}`);
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
if (!process.exitCode) console.log(`smoke: PASS (screenshots in ${path.relative(process.cwd(), outDir)}/)`);
