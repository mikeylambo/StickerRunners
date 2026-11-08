/**
 * Course = a Track plus every stickable surface and hazard, all in track space (s, lateral, height).
 * Surfaces are axis-aligned rectangles in (s, lateral) at a fixed height with a normal sign:
 *   +1 = top face (you stand on it, height above it is positive)
 *   -1 = underside (you hang beneath it)
 */
import { Track, type TrackSegment } from "./Track";

export type SurfaceKind = "road" | "island" | "underside";

export interface Surface {
  id: number;
  kind: SurfaceKind;
  s0: number; s1: number;
  l0: number; l1: number;
  /** Height of the face in track space. */
  h: number;
  /** +1 top face, -1 underside face. */
  n: 1 | -1;
  /** Slab thickness for rendering. */
  thickness: number;
  /** Underside surfaces only: the void edge folds Tack round onto the top face. */
  wrapToTop?: boolean;
  /** Rail side (lateral +) is solid instead of a void edge. */
  railRight?: boolean;
}

export interface Hazard {
  s0: number; s1: number;
  l0: number; l1: number;
  /** Top of the hazard above the road face. Peeled Tack above this passes clean. */
  height: number;
}

export interface Gap { s0: number; s1: number }

export interface IslandDef { s0: number; s1: number; lat: number; width: number; h: number }

export interface StageDef {
  id: string;
  segments: TrackSegment[];
  elevation: (s: number) => number;
  gaps: Gap[];
  islands: IslandDef[];
  underside: Array<{ s0: number; s1: number }>;
  hazards: Hazard[];
  finishMargin: number;
  roadThickness: number;
}

export class Course {
  readonly track: Track;
  readonly surfaces: Surface[] = [];
  readonly hazards: Hazard[];
  readonly gaps: Gap[];
  readonly halfWidth: number;
  readonly finishS: number;
  readonly startS = 4;

  constructor(readonly stage: StageDef, ribbonWidth: number) {
    this.track = new Track(stage.segments, stage.elevation);
    this.halfWidth = ribbonWidth / 2;
    this.hazards = stage.hazards;
    this.gaps = [...stage.gaps].sort((a, b) => a.s0 - b.s0);
    this.finishS = this.track.length - stage.finishMargin;
    let id = 0;
    // road top = track length minus the gaps
    let cursor = 0;
    for (const g of this.gaps) {
      if (g.s0 > cursor) this.surfaces.push(this.road(id++, cursor, g.s0, stage.roadThickness));
      cursor = g.s1;
    }
    this.surfaces.push(this.road(id++, cursor, this.track.length + 200, stage.roadThickness));
    for (const u of stage.underside) {
      this.surfaces.push({
        id: id++, kind: "underside", s0: u.s0, s1: u.s1, l0: -this.halfWidth, l1: this.halfWidth,
        h: -stage.roadThickness, n: -1, thickness: 0, wrapToTop: true, railRight: true
      });
    }
    for (const isl of stage.islands) {
      this.surfaces.push({
        id: id++, kind: "island", s0: isl.s0, s1: isl.s1, l0: isl.lat - isl.width / 2, l1: isl.lat + isl.width / 2,
        h: isl.h, n: 1, thickness: 0.7
      });
    }
  }

  private road(id: number, s0: number, s1: number, thickness: number): Surface {
    return { id, kind: "road", s0, s1, l0: -this.halfWidth, l1: this.halfWidth, h: 0, n: 1, thickness, railRight: true };
  }

  surface(id: number): Surface | undefined { return this.surfaces[id]; }

  inGap(s: number): boolean { return this.gaps.some((g) => s >= g.s0 && s < g.s1); }

  /** Road-top surface containing s (ignores lateral). */
  roadAt(s: number): Surface | undefined {
    return this.surfaces.find((x) => x.kind === "road" && s >= x.s0 && s < x.s1);
  }

  /** A surface whose rect contains (s, lat) and whose face matches height h and normal n. */
  supportAt(s: number, lat: number, h: number, n: 1 | -1, eps = 0.05): Surface | undefined {
    return this.surfaces.find((x) => x.n === n && Math.abs(x.h - h) < eps && s >= x.s0 && s < x.s1 && lat >= x.l0 && lat <= x.l1);
  }

  /** The facing surface straight along -n·U from (s, lat, h): what your contact shadow lands on. */
  surfaceBeneath(s: number, lat: number, h: number, n: 1 | -1): Surface | undefined {
    let best: Surface | undefined; let bestD = Infinity;
    for (const x of this.surfaces) {
      if (x.n !== n) continue;
      if (s < x.s0 || s >= x.s1 || lat < x.l0 || lat > x.l1) continue;
      const d = (h - x.h) * n;
      if (d >= -0.01 && d < bestD) { bestD = d; best = x; }
    }
    return best;
  }

  hazardAt(s: number, lat: number, halfWidth: number): Hazard | undefined {
    return this.hazards.find((z) => s >= z.s0 && s < z.s1 && lat + halfWidth >= z.l0 && lat - halfWidth <= z.l1);
  }
}
