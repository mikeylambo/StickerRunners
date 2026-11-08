/**
 * Greybox course meshes: the spline-extruded ribbon (top, sides, underside), the gold rail on the
 * lower/right edge, debris islands, blade hazards, the underside-section markings and the finish strip.
 * Presentation only — every shape is built from the sim's track-space rectangles.
 */
import * as THREE from "three";
import type { Course, Surface } from "../sim/Course";

interface Rect { s0: number; s1: number; l0: number; l1: number; h: number; thickness: number }
interface SlabColors { top: string; side: string; bottom: string }

const STEP = 2;

/** Extrude a track-space rectangle into a slab following the spline. */
function slab(course: Course, r: Rect, colors: SlabColors, out: { pos: number[]; col: number[] }): void {
  const tr = course.track;
  const ss: number[] = [];
  for (let s = r.s0; s < r.s1; s += STEP) ss.push(s);
  ss.push(Math.min(r.s1, tr.length + 200));
  const ring = ss.map((s) => {
    const f = tr.frameAt(s);
    const w = (l: number, h: number) => tr.toWorld(s, l, h, f);
    return { tl: w(r.l0, r.h), tr: w(r.l1, r.h), bl: w(r.l0, r.h - r.thickness), br: w(r.l1, r.h - r.thickness) };
  });
  const top = new THREE.Color(colors.top); const side = new THREE.Color(colors.side); const bot = new THREE.Color(colors.bottom);
  type P = { x: number; y: number; z: number };
  const quad = (a: P, b: P, c: P, d: P, color: THREE.Color) => {
    for (const p of [a, b, c, a, c, d]) { out.pos.push(p.x, p.y, p.z); out.col.push(color.r, color.g, color.b); }
  };
  for (let i = 0; i < ring.length - 1; i++) {
    const A = ring[i]; const B = ring[i + 1];
    quad(A.tl, B.tl, B.tr, A.tr, top);
    quad(A.br, B.br, B.bl, A.bl, bot);
    quad(A.bl, B.bl, B.tl, A.tl, side);
    quad(A.tr, B.tr, B.br, A.br, side);
  }
  const f = ring[0]; const l = ring[ring.length - 1];
  quad(f.tl, f.tr, f.br, f.bl, side);
  quad(l.tr, l.tl, l.bl, l.br, side);
}

function meshFrom(buf: { pos: number[]; col: number[] }, material: THREE.Material): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(buf.pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(buf.col, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

export class CourseView {
  readonly group = new THREE.Group();

  constructor(course: Course) {
    const lit = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
    const solid = { pos: [] as number[], col: [] as number[] };
    const emissive = { pos: [] as number[], col: [] as number[] };
    const hw = course.halfWidth;
    const undersides = course.surfaces.filter((x) => x.kind === "underside");
    const underAt = (s0: number, s1: number) => undersides.filter((u) => u.s1 > s0 && u.s0 < s1);

    for (const x of course.surfaces) {
      if (x.kind === "road") this.road(course, x, solid, emissive, underAt(x.s0, x.s1));
      else if (x.kind === "island") {
        slab(course, { ...x, thickness: x.thickness }, { top: "#c79a6b", side: "#6a4a36", bottom: "#3e2b22" }, solid);
        // a lighter lip on the island's edges so it reads as a separate surface at speed
        slab(course, { s0: x.s0, s1: x.s1, l0: x.l0, l1: x.l0 + 0.25, h: x.h + 0.01, thickness: 0.02 }, { top: "#e7c49a", side: "#e7c49a", bottom: "#e7c49a" }, solid);
        slab(course, { s0: x.s0, s1: x.s1, l0: x.l1 - 0.25, l1: x.l1, h: x.h + 0.01, thickness: 0.02 }, { top: "#e7c49a", side: "#e7c49a", bottom: "#e7c49a" }, solid);
      }
    }
    // blades: dark red, no white (GDD §13 — hazards use no white at all)
    for (const z of course.hazards) {
      slab(course, { s0: z.s0, s1: z.s1, l0: z.l0, l1: z.l1, h: z.height, thickness: z.height }, { top: "#e0334f", side: "#7a1530", bottom: "#4a0a1c" }, solid);
    }
    // finish strip
    slab(course, { s0: course.finishS, s1: course.finishS + 2, l0: -hw, l1: hw, h: 0.012, thickness: 0.01 }, { top: "#7ef0c8", side: "#7ef0c8", bottom: "#7ef0c8" }, emissive);
    this.group.add(meshFrom(solid, lit), meshFrom(emissive, glow));
  }

  private road(course: Course, x: Surface, solid: { pos: number[]; col: number[] }, emissive: { pos: number[]; col: number[] }, unders: Surface[]): void {
    const s1 = Math.min(x.s1, course.track.length + 60);
    const t = x.thickness;
    // split around underside sections so the underside face can be marked
    let cursor = x.s0;
    const parts: Array<{ s0: number; s1: number; under: boolean }> = [];
    for (const u of unders) {
      if (u.s0 > cursor) parts.push({ s0: cursor, s1: Math.min(u.s0, s1), under: false });
      parts.push({ s0: Math.max(u.s0, cursor), s1: Math.min(u.s1, s1), under: true });
      cursor = Math.min(u.s1, s1);
    }
    if (cursor < s1) parts.push({ s0: cursor, s1, under: false });
    for (const p of parts) {
      slab(course, { s0: p.s0, s1: p.s1, l0: x.l0, l1: x.l1, h: x.h, thickness: t },
        p.under ? { top: "#7d88bd", side: "#3f4675", bottom: "#4fb6c4" } : { top: "#7d88bd", side: "#3f4675", bottom: "#262a4c" }, solid);
      if (p.under) {
        // fold edge: dashed cyan on the void edge where the underside wraps back to the top
        for (let s = p.s0; s < p.s1; s += 4) {
          slab(course, { s0: s, s1: Math.min(s + 2, p.s1), l0: x.l0, l1: x.l0 + 0.18, h: x.h + 0.012, thickness: t + 0.03 }, { top: "#8ff0f4", side: "#8ff0f4", bottom: "#8ff0f4" }, emissive);
        }
      }
    }
    // void edge: a slightly lighter lip so the drop-off reads
    slab(course, { s0: x.s0, s1, l0: x.l0, l1: x.l0 + 0.12, h: x.h + 0.006, thickness: 0.01 }, { top: "#a7b0e0", side: "#a7b0e0", bottom: "#a7b0e0" }, solid);
    // gold rail on the lower/right (+lateral) edge
    slab(course, { s0: x.s0, s1, l0: x.l1 + 0.01, l1: x.l1 + 0.24, h: x.h + 0.38, thickness: 0.38 + t - 0.02 }, { top: "#ffd75a", side: "#e0a92a", bottom: "#7a5a14" }, emissive);
  }
}
