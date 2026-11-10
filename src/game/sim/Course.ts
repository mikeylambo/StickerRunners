/**
 * Course = a Track plus every stickable surface and hazard, all in track space (s, lateral, height).
 *
 * Two surface orientations:
 *  - axis "h"   (floors/undersides): a rect in (s, lateral) at fixed height `h`.
 *                n = +1 top face (stand on it), n = -1 underside (hang beneath it).
 *  - axis "lat" (walls): a rect in (s, height) at fixed lateral `wl`, spanning h0…h1.
 *                n = +1 faces toward +lateral, n = -1 faces toward -lateral.
 * Floors may move slowly (sideways or up/down) as a pure function of sim time, so the sim stays deterministic.
 */
import { Track, type TrackSegment } from "./Track";

export type SurfaceKind = "road" | "island" | "underside" | "strand" | "platform" | "wall";
export type FaceAxis = "h" | "lat";

export interface SurfaceMotion {
  /** Which coordinate moves: "lat" = sideways, "h" = up/down. */
  axis: "lat" | "h";
  amp: number;
  period: number;
  phase: number;
}

export interface Surface {
  id: number;
  kind: SurfaceKind;
  /** Face orientation. Floors/undersides "h", walls "lat". */
  axis: FaceAxis;
  name?: string;
  color?: string;
  s0: number; s1: number;
  /** Floors: lateral extent. Walls: both equal the face lateral `wl`. */
  l0: number; l1: number;
  /** Floors: face height. Walls: top of the wall (h1). */
  h: number;
  /** Walls only: face lateral and height extent. */
  wl?: number; h0?: number; h1?: number;
  n: 1 | -1;
  /** Slab thickness for rendering. */
  thickness: number;
  /** Underside surfaces only: the void edge folds Tack round onto the top face. */
  wrapToTop?: boolean;
  /** Rail side (lateral +) is solid instead of a void edge. */
  railRight?: boolean;
  /** Moving floors: motion and the rest position it oscillates about. */
  motion?: SurfaceMotion;
  base?: { l0: number; l1: number; h: number };
  /** Undersides created for a strand point at their strand (render colour). */
  parent?: number;
}

export interface Hazard {
  s0: number; s1: number;
  l0: number; l1: number;
  /** Top of the hazard above the face it sits on. Peeled Tack above this passes clean. */
  height: number;
  /** Height of the face it sits on (default 0 = the ribbon). */
  h?: number;
}

export interface Gap { s0: number; s1: number }

export interface IslandDef { s0: number; s1: number; lat: number; width: number; h: number }

export interface StrandDef {
  name: string;
  kind?: "strand" | "platform";
  s0: number; s1: number;
  lat: number; width: number; h: number;
  color: string;
  rail?: boolean;
  thickness?: number;
  /** s-range where this strand's underside is stickable. */
  underside?: { s0: number; s1: number };
  motion?: SurfaceMotion;
}

export interface WallDef { name: string; s0: number; s1: number; lat: number; h0: number; h1: number; n: 1 | -1; color: string }

export interface StageDef {
  id: string;
  segments: TrackSegment[];
  elevation: (s: number) => number;
  /** Build the default ribbon (minus gaps). Default true. */
  road?: boolean;
  gaps: Gap[];
  islands: IslandDef[];
  underside: Array<{ s0: number; s1: number }>;
  hazards: Hazard[];
  strands?: StrandDef[];
  walls?: WallDef[];
  finishMargin: number;
  roadThickness: number;
  /** Starting lateral (default 0). */
  startLat?: number;
  /** Camera follows this fraction of Tack's height (default 0 = the flat ribbon camera). */
  cameraHeightFollow?: number;
}

export class Course {
  readonly track: Track;
  readonly surfaces: Surface[] = [];
  readonly hazards: Hazard[];
  readonly gaps: Gap[];
  readonly halfWidth: number;
  readonly finishS: number;
  readonly startS = 4;
  /** Sim time the moving surfaces are currently posed at. */
  time = 0;

  constructor(readonly stage: StageDef, ribbonWidth: number) {
    this.track = new Track(stage.segments, stage.elevation);
    this.halfWidth = ribbonWidth / 2;
    this.hazards = stage.hazards;
    this.gaps = [...stage.gaps].sort((a, b) => a.s0 - b.s0);
    this.finishS = this.track.length - stage.finishMargin;
    let id = 0;
    if (stage.road !== false) {
      // road top = track length minus the gaps
      let cursor = 0;
      for (const g of this.gaps) {
        if (g.s0 > cursor) this.surfaces.push(this.road(id++, cursor, g.s0, stage.roadThickness));
        cursor = g.s1;
      }
      this.surfaces.push(this.road(id++, cursor, this.track.length + 200, stage.roadThickness));
      for (const u of stage.underside) {
        this.surfaces.push({
          id: id++, kind: "underside", axis: "h", s0: u.s0, s1: u.s1, l0: -this.halfWidth, l1: this.halfWidth,
          h: -stage.roadThickness, n: -1, thickness: 0, wrapToTop: true, railRight: true
        });
      }
    }
    for (const isl of stage.islands) {
      this.surfaces.push({
        id: id++, kind: "island", axis: "h", s0: isl.s0, s1: isl.s1, l0: isl.lat - isl.width / 2, l1: isl.lat + isl.width / 2,
        h: isl.h, n: 1, thickness: 0.7
      });
    }
    for (const st of stage.strands ?? []) {
      const l0 = st.lat - st.width / 2; const l1 = st.lat + st.width / 2;
      const thickness = st.thickness ?? stage.roadThickness;
      const top: Surface = {
        id: id++, kind: st.kind ?? "strand", axis: "h", name: st.name, color: st.color, s0: st.s0, s1: st.s1, l0, l1,
        h: st.h, n: 1, thickness, railRight: st.rail, motion: st.motion, base: st.motion ? { l0, l1, h: st.h } : undefined
      };
      this.surfaces.push(top);
      if (st.underside) {
        this.surfaces.push({
          id: id++, kind: "underside", axis: "h", name: `${st.name}-under`, color: st.color, s0: st.underside.s0, s1: st.underside.s1,
          l0, l1, h: st.h - thickness, n: -1, thickness: 0, railRight: st.rail, parent: top.id
        });
      }
    }
    for (const w of stage.walls ?? []) {
      this.surfaces.push({
        id: id++, kind: "wall", axis: "lat", name: w.name, color: w.color, s0: w.s0, s1: w.s1, l0: w.lat, l1: w.lat,
        h: w.h1, wl: w.lat, h0: w.h0, h1: w.h1, n: w.n, thickness: 0.6
      });
    }
    this.update(0);
  }

  private road(id: number, s0: number, s1: number, thickness: number): Surface {
    return { id, kind: "road", axis: "h", s0, s1, l0: -this.halfWidth, l1: this.halfWidth, h: 0, n: 1, thickness, railRight: true };
  }

  surface(id: number): Surface | undefined { return this.surfaces[id]; }
  byName(name: string): Surface | undefined { return this.surfaces.find((x) => x.name === name); }

  /** Offset of a moving surface from its rest position at sim time t. */
  offsetAt(x: Surface, t: number): number {
    const m = x.motion;
    return m ? m.amp * Math.sin((2 * Math.PI * t) / m.period + m.phase) : 0;
  }

  /** Pose every moving surface for sim time t (also underside twins are static, so only floors move). */
  update(t: number): void {
    this.time = t;
    for (const x of this.surfaces) {
      if (!x.motion || !x.base) continue;
      const o = this.offsetAt(x, t);
      if (x.motion.axis === "lat") { x.l0 = x.base.l0 + o; x.l1 = x.base.l1 + o; }
      else x.h = x.base.h + o;
    }
  }

  inGap(s: number): boolean { return this.stage.road !== false && this.gaps.some((g) => s >= g.s0 && s < g.s1); }

  /** Road-top surface containing s (ignores lateral). */
  roadAt(s: number): Surface | undefined {
    return this.surfaces.find((x) => x.kind === "road" && s >= x.s0 && s < x.s1);
  }

  /** Where a start / respawn can stand at s: the road, else the widest static strand containing s. */
  spawnAt(s: number): Surface | undefined {
    const road = this.roadAt(s);
    if (road) return road;
    let best: Surface | undefined;
    for (const x of this.surfaces) {
      if (x.kind !== "strand" || x.axis !== "h" || x.n !== 1 || x.motion || s < x.s0 || s >= x.s1) continue;
      if (!best || x.l1 - x.l0 > best.l1 - best.l0) best = x;
    }
    return best;
  }

  /** Is (s, lat, h) inside x's rect (its in-plane coordinates)? */
  contains(x: Surface, s: number, lat: number, h: number): boolean {
    if (s < x.s0 || s >= x.s1) return false;
    return x.axis === "h" ? lat >= x.l0 && lat <= x.l1 : h >= x.h0! && h <= x.h1!;
  }

  /** Face coordinate of a point along x's face axis. */
  static face(x: Surface): number { return x.axis === "h" ? x.h : x.wl!; }

  /** A floor surface whose rect contains (s, lat) and whose face matches height h and normal n. */
  supportAt(s: number, lat: number, h: number, n: 1 | -1, eps = 0.05): Surface | undefined {
    return this.surfaces.find((x) => x.axis === "h" && x.n === n && Math.abs(x.h - h) < eps && s >= x.s0 && s < x.s1 && lat >= x.l0 && lat <= x.l1);
  }

  /** A wall at lateral `lat` (±eps) facing n that contains (s, h). */
  wallAt(s: number, lat: number, h: number, n: 1 | -1, eps = 0.05): Surface | undefined {
    return this.surfaces.find((x) => x.axis === "lat" && x.n === n && Math.abs(x.wl! - lat) < eps && this.contains(x, s, lat, h));
  }

  /** The facing surface straight along the face normal (axis) from (s, lat, h): what your contact shadow lands on. */
  surfaceBeneath(s: number, lat: number, h: number, n: 1 | -1, axis: FaceAxis = "h"): Surface | undefined {
    let best: Surface | undefined; let bestD = Infinity;
    for (const x of this.surfaces) {
      if (x.n !== n || x.axis !== axis || !this.contains(x, s, lat, h)) continue;
      const d = ((axis === "h" ? h : lat) - Course.face(x)) * n;
      if (d >= -0.01 && d < bestD) { bestD = d; best = x; }
    }
    return best;
  }

  hazardAt(s: number, lat: number, halfWidth: number, faceH = 0): Hazard | undefined {
    return this.hazards.find((z) => Math.abs((z.h ?? 0) - faceH) < 0.05 && s >= z.s0 && s < z.s1 && lat + halfWidth >= z.l0 && lat - halfWidth <= z.l1);
  }
}
