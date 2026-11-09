/**
 * ?diag: one line of on-screen diagnostics so a device can be measured without a console:
 * fps, average / p95 frame interval, pixel ratio, drawing buffer, orientation, context type, GPU.
 */
import type { Game } from "../Game";

export function installDiagnostics(game: Game): void {
  const el = document.createElement("div");
  el.id = "sr-diag";
  el.setAttribute("data-sr-ui", "");
  el.style.cssText = "position:fixed;left:calc(env(safe-area-inset-left,0px) + 6px);bottom:calc(env(safe-area-inset-bottom,0px) + 6px);" +
    "z-index:9998;font:11px/1.35 ui-monospace,Menlo,monospace;color:#d8ffe8;background:rgba(0,0,0,.6);padding:4px 7px;border-radius:6px;pointer-events:none;white-space:pre";
  document.body.appendChild(el);
  const gl = game.renderer.getContext();
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  const samples: number[] = [];
  let last = 0; let shown = 0;
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    if (last) { samples.push(now - last); if (samples.length > 240) samples.shift(); }
    last = now;
    if (now - shown < 500 || samples.length < 10) return;
    shown = now;
    const sorted = [...samples].sort((a, b) => a - b);
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const c = game.renderer.domElement;
    el.textContent = `${(1000 / avg).toFixed(0)} fps · avg ${avg.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms\n` +
      `dpr ${devicePixelRatio} → ${game.perf.ratio} · buffer ${c.width}×${c.height} · ${game.portrait ? "portrait" : "landscape"} · ${game.rendererAttempt}\n${gpu}`;
  };
  requestAnimationFrame(tick);
}
