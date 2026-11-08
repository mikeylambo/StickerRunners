/**
 * ?tells debug overlay: outlines every stickable surface and hazard rect, and draws the live
 * slap aim axis plus the target the sim would pick if you released now.
 */
import * as THREE from "three";
import type { Course } from "../sim/Course";
import type { Sim } from "../sim/Sim";
import { DT } from "../sim/Sim";
import { aimAxis, findSlapTarget } from "../sim/Targeting";
import { slap } from "../../../config/tuning";

export class DebugView {
  readonly group = new THREE.Group();
  private readonly aim: THREE.Line;
  private readonly marker: THREE.Mesh;

  constructor(private readonly course: Course) {
    const tr = course.track;
    const pts: number[] = [];
    const rect = (s0: number, s1: number, l0: number, l1: number, h: number) => {
      const ss: number[] = [];
      for (let s = s0; s < s1; s += 4) ss.push(s);
      ss.push(Math.min(s1, tr.length + 50));
      for (let i = 0; i < ss.length - 1; i++) for (const l of [l0, l1]) {
        const a = tr.toWorld(ss[i], l, h); const b = tr.toWorld(ss[i + 1], l, h);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      for (const s of [ss[0], ss[ss.length - 1]]) {
        const a = tr.toWorld(s, l0, h); const b = tr.toWorld(s, l1, h);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    };
    for (const x of course.surfaces) rect(x.s0, x.s1, x.l0, x.l1, x.h + x.n * 0.05);
    for (const z of course.hazards) rect(z.s0, z.s1, z.l0, z.l1, z.height + 0.02);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: "#00ff9c", depthTest: false, transparent: true, opacity: 0.6 })));
    this.aim = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: "#ffee00", depthTest: false }));
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: "#ffee00", depthTest: false }));
    this.aim.renderOrder = this.marker.renderOrder = 20;
    this.group.add(this.aim, this.marker);
  }

  update(sim: Sim): void {
    const p = sim.p; const tr = this.course.track;
    const show = p.state === "peeled" || (p.state === "falling" && p.canSlap);
    this.aim.visible = this.marker.visible = show;
    if (!show) return;
    const below = -(this.course.stage.roadThickness + 0.05);
    const ax = aimAxis(p.h, p.steer, slap, below);
    const a = tr.toWorld(p.s, p.lat, p.h);
    const b = tr.toWorld(p.s + ax.s * slap.slapRange, p.lat + ax.l * slap.slapRange, p.h + ax.h * slap.slapRange);
    this.aim.geometry.setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]);
    const t = findSlapTarget(this.course, p, p.steer, p.speed * slap.snapFrames * DT, slap, below);
    this.marker.visible = !!t;
    if (t) { const m = tr.toWorld(t.s, t.lat, t.h); this.marker.position.set(m.x, m.y, m.z); }
  }
}
