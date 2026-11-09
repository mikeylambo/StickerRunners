/**
 * WebGLRenderer creation with a fallback and loud failure reporting.
 * Three r180 needs WebGL2. If the preferred context fails (GPU blocklist, hardware acceleration off,
 * dual-GPU Mac refusing high-performance), retry with the most conservative attributes before giving up.
 * Shader compile/link failures and context loss are reported on screen, not just in the console.
 */
import * as THREE from "three";
import { report } from "../dev/report";

export interface RendererChoice { renderer: THREE.WebGLRenderer; attempt: string }

export function createRenderer(canvas: HTMLCanvasElement, opts: { antialias: boolean; preserveDrawingBuffer: boolean }): RendererChoice {
  const attempts: Array<[string, THREE.WebGLRendererParameters]> = [
    ["high-performance", { antialias: opts.antialias, powerPreference: "high-performance" }],
    ["default", { antialias: false, powerPreference: "default" }],
    ["low-power", { antialias: false, powerPreference: "low-power", failIfMajorPerformanceCaveat: false }]
  ];
  const errors: string[] = [];
  for (const [name, params] of attempts) {
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: opts.preserveDrawingBuffer, ...params });
      if (errors.length) report(`WebGL: fell back to "${name}" context`, errors.join("\n"));
      hook(renderer, canvas);
      return { renderer, attempt: name };
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const msg = `Could not create a WebGL2 context.\n${errors.join("\n")}\n` +
    "Check that hardware acceleration is on (Chrome: Settings → System; Safari: WebGL enabled) and try another browser.";
  report("WebGL unavailable", msg);
  throw new Error(msg);
}

function hook(renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement): void {
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, vs, fs) => {
    const log = [
      gl.getProgramInfoLog(program) ?? "",
      `vertex: ${gl.getShaderInfoLog(vs) ?? ""}`,
      `fragment: ${gl.getShaderInfoLog(fs) ?? ""}`
    ].join("\n").trim();
    report("Shader compile/link failed", log);
  };
  canvas.addEventListener("webglcontextlost", () => report("WebGL context lost", "The GPU dropped the context. Trying to restore…"));
  canvas.addEventListener("webglcontextrestored", () => report("WebGL context restored", "If the screen stays blank, reload the page."));
}
