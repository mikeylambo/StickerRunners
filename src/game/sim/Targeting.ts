/**
 * Slap targeting: nearest valid surface inside a cone toward the stick direction.
 *
 * Works in track space (s, lateral, height) treated as Euclidean; at Phase 0 curvatures
 * (radius ≥ 350 m) the distortion at |lateral| ≤ 16 m is under 5%.
 *
 * A surface is a candidate only if Tack is on its facing side. Three candidate points per surface:
 *  (a) straight along the face normal: if your contact shadow is on it, it is always valid;
 *  (b) where the aim ray meets the face plane;
 *  (c) the face point nearest the aim point and nearest Tack.
 * Valid = within slapRange and within the cone (except (a), which is cone-exempt — DECISIONS.md).
 * Among valid candidates, the nearest wins (handoff step 6).
 */
import type { Course, Surface } from "./Course";
import type { SlapTuning } from "../../../config/tuning";

export interface SlapTarget {
  surface: Surface;
  s: number; lat: number; h: number;
  dist: number;
  angleDeg: number;
  via: "beneath" | "ray" | "cone";
}

export interface AimAxis { s: number; l: number; h: number }

export function aimAxis(h: number, steer: number, t: SlapTuning, belowSheet: number): AimAxis {
  // Above the sheet aim down at it; below the sheet (under the road's underside) aim up at it.
  const vert = h < belowSheet ? 1 : -1;
  const a = { s: t.aimForward, l: steer, h: vert * t.aimVertical };
  const len = Math.hypot(a.s, a.l, a.h) || 1;
  return { s: a.s / len, l: a.l / len, h: a.h / len };
}

const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b);

export function findSlapTarget(
  course: Course,
  pos: { s: number; lat: number; h: number },
  steer: number,
  lookAheadS: number,
  t: SlapTuning,
  belowSheet: number
): SlapTarget | null {
  const axis = aimAxis(pos.h, steer, t, belowSheet);
  const cosCone = Math.cos((t.slapConeDeg * Math.PI) / 180);
  const range = t.slapRange;
  let best: SlapTarget | null = null;

  const consider = (x: Surface, s: number, l: number, via: SlapTarget["via"]) => {
    const ds = s - pos.s; const dl = l - pos.lat; const dh = x.h - pos.h;
    const dist = Math.hypot(ds, dl, dh);
    if (dist > range) return;
    let angleDeg = 0;
    if (via !== "beneath") {
      const c = dist > 1e-6 ? (ds * axis.s + dl * axis.l + dh * axis.h) / dist : 1;
      if (c < cosCone) return;
      angleDeg = (Math.acos(clamp(c, -1, 1)) * 180) / Math.PI;
    }
    if (!best || dist < best.dist) best = { surface: x, s, lat: l, h: x.h, dist, angleDeg, via };
  };

  for (const x of course.surfaces) {
    if (x.s1 < pos.s - range || x.s0 > pos.s + range * 2) continue;
    const facing = (pos.h - x.h) * x.n;
    if (facing <= 0.02) continue;
    const inRect = (s: number, l: number) => s >= x.s0 && s < x.s1 && l >= x.l0 && l <= x.l1;
    // (a) straight along the normal — the surface your shadow is on
    const sa = pos.s + lookAheadS;
    if (inRect(sa, pos.lat)) consider(x, sa, pos.lat, "beneath");
    // (b) aim ray meets the face plane
    if (axis.h * x.n < 0) {
      const tt = (x.h - pos.h) / axis.h;
      if (tt > 0 && tt <= range) {
        const s = pos.s + axis.s * tt; const l = pos.lat + axis.l * tt;
        if (inRect(s, l)) consider(x, s, l, "ray");
      }
    }
    // (c) nearest face point to the aim point, and to Tack
    const aimS = pos.s + axis.s * range * 0.5; const aimL = pos.lat + axis.l * range * 0.5;
    consider(x, clamp(aimS, x.s0, x.s1 - 0.01), clamp(aimL, x.l0, x.l1), "cone");
    consider(x, clamp(pos.s, x.s0, x.s1 - 0.01), clamp(pos.lat, x.l0, x.l1), "cone");
  }
  return best;
}
