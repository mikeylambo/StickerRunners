/**
 * Slap targeting: nearest valid surface inside a cone toward the stick direction.
 *
 * Works on floors (face ⟂ height) and walls (face ⟂ lateral) alike, in track space (s, lateral, height) treated as Euclidean; at Phase 0 curvatures
 * (radius ≥ 350 m) the distortion at |lateral| ≤ 16 m is under 5%.
 *
 * A surface is a candidate only if Tack is on its facing side. Three candidate points per surface:
 *  (a) straight along the face normal: if your contact shadow is on it, it is always valid;
 *  (b) where the aim ray meets the face plane;
 *  (c) the face point nearest the aim point and nearest Tack.
 * Valid = within slapRange and within the cone (except (a), which is cone-exempt — DECISIONS.md).
 * Among valid candidates, the nearest wins (handoff step 6).
 */
import { Course, type Surface, type FaceAxis } from "./Course";
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
  belowSheet: number,
  /** Face axis of the surface Tack is on / peeled from: "beneath" only looks along this axis. */
  ownAxis: FaceAxis = "h"
): SlapTarget | null {
  const axis = aimAxis(pos.h, steer, t, belowSheet);
  const cosCone = Math.cos((t.slapConeDeg * Math.PI) / 180);
  const range = t.slapRange;
  let best: SlapTarget | null = null;
  const P = [pos.s, pos.lat, pos.h];
  const A = [axis.s, axis.l, axis.h];

  // Points are [s, lat, h]. fa = index of the face axis (2 floors, 1 walls), ca = in-plane cross axis.
  const consider = (x: Surface, q: number[], via: SlapTarget["via"]) => {
    const ds = q[0] - P[0]; const dl = q[1] - P[1]; const dh = q[2] - P[2];
    const dist = Math.hypot(ds, dl, dh);
    if (dist > range) return;
    let angleDeg = 0;
    if (via !== "beneath") {
      const c = dist > 1e-6 ? (ds * A[0] + dl * A[1] + dh * A[2]) / dist : 1;
      if (c < cosCone) return;
      angleDeg = (Math.acos(clamp(c, -1, 1)) * 180) / Math.PI;
    }
    if (!best || dist < best.dist) best = { surface: x, s: q[0], lat: q[1], h: q[2], dist, angleDeg, via };
  };

  for (const x of course.surfaces) {
    if (x.s1 < pos.s - range || x.s0 > pos.s + range * 2) continue;
    const fa = x.axis === "h" ? 2 : 1;
    const ca = x.axis === "h" ? 1 : 2;
    const fv = Course.face(x);
    const c0 = x.axis === "h" ? x.l0 : x.h0!;
    const c1 = x.axis === "h" ? x.l1 : x.h1!;
    if ((P[fa] - fv) * x.n <= 0.02) continue; // must be on the facing side
    const inRect = (q: number[]) => q[0] >= x.s0 && q[0] < x.s1 && q[ca] >= c0 && q[ca] <= c1;
    const pt = (s: number, c: number) => { const q = [s, 0, 0]; q[fa] = fv; q[ca] = c; return q; };
    // (a) straight along the normal — the surface your shadow is on (same face axis only)
    const sa = pos.s + lookAheadS;
    if (x.axis === ownAxis && inRect(pt(sa, P[ca]))) consider(x, pt(sa, P[ca]), "beneath");
    // (b) aim ray meets the face plane
    if (A[fa] * x.n < 0) {
      const tt = (fv - P[fa]) / A[fa];
      if (tt > 0 && tt <= range) {
        const q = pt(P[0] + A[0] * tt, P[ca] + A[ca] * tt);
        if (inRect(q)) consider(x, q, "ray");
      }
    }
    // (c) nearest face point to the aim point, and to Tack
    consider(x, pt(clamp(P[0] + A[0] * range * 0.5, x.s0, x.s1 - 0.01), clamp(P[ca] + A[ca] * range * 0.5, c0, c1)), "cone");
    consider(x, pt(clamp(P[0], x.s0, x.s1 - 0.01), clamp(P[ca], c0, c1)), "cone");
  }
  return best;
}
