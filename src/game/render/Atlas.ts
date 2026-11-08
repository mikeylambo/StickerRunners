/**
 * Placeholder sprite atlas. Every sprite is looked up by a semantic key, so final art swaps in
 * by registering a different factory for the same key. Phase 0 = procedural canvas shapes only.
 */
import * as THREE from "three";

export type SpriteFactory = () => THREE.Texture;

const factories = new Map<string, SpriteFactory>();
const cache = new Map<string, THREE.Texture>();

export function registerSprite(key: string, factory: SpriteFactory): void {
  factories.set(key, factory);
  cache.get(key)?.dispose();
  cache.delete(key);
}

export function sprite(key: string): THREE.Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const f = factories.get(key);
  if (!f) throw new Error(`No sprite registered for atlas key "${key}"`);
  const tex = f();
  cache.set(key, tex);
  return tex;
}

/** Texture size and padding shared with the die-cut shader (border needs transparent room). */
export const TACK_TEX = { w: 128, h: 128, pad: 18 };

// Tack placeholder: a round vinyl critter with a cape-tab, one strong accent colour, 3 tones.
registerSprite("tack.idle", () => {
  const c = document.createElement("canvas");
  c.width = TACK_TEX.w; c.height = TACK_TEX.h;
  const g = c.getContext("2d")!;
  const cx = 64; const cy = 70; const r = 38;
  // cape tab (behind, upper-left)
  g.fillStyle = "#c2306a";
  g.beginPath(); g.moveTo(cx - 22, cy - 30); g.lineTo(cx - 50, cy - 46); g.lineTo(cx - 40, cy - 8); g.closePath(); g.fill();
  // body
  g.fillStyle = "#ff5a8a";
  g.beginPath(); g.ellipse(cx, cy, r, r * 0.95, 0, 0, Math.PI * 2); g.fill();
  // shade
  g.fillStyle = "#d93f6f";
  g.beginPath(); g.ellipse(cx + 6, cy + 12, r * 0.85, r * 0.62, 0, 0, Math.PI); g.fill();
  // highlight
  g.fillStyle = "#ff9ab8";
  g.beginPath(); g.ellipse(cx - 12, cy - 16, 12, 7, -0.5, 0, Math.PI * 2); g.fill();
  // eyes (looking up-right, the direction of travel on screen)
  g.fillStyle = "#1a1020";
  g.beginPath(); g.ellipse(cx + 8, cy - 6, 5, 8, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 24, cy - 8, 5, 8, 0, 0, Math.PI * 2); g.fill();
  // feet
  g.fillStyle = "#c2306a";
  g.fillRect(cx - 18, cy + 30, 12, 8); g.fillRect(cx + 8, cy + 30, 12, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace; // the die-cut ShaderMaterial writes raw sRGB values
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
});
