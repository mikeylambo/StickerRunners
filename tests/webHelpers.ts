import { Course, type Surface } from "../src/game/sim/Course";
import { Sim } from "../src/game/sim/Sim";
import { webStage } from "../data/stages/web";
import { simTuning, move } from "../config/tuning";
import { reachableTargets } from "../src/game/sim/Reach";

export function makeWebSim() { return new Sim(new Course(webStage, move.ribbonWidth), simTuning); }

/** Stand Tack on x at (s, cross) where cross = lateral (floors) or height (walls), at sim time t. */
export function standOn(sim: Sim, x: Surface, s: number, cross: number, t: number, speed = 32) {
  sim.time = t; sim.course.update(t);
  const p = sim.p;
  Object.assign(p, { state: "stuck", s, n: x.n, axis: x.axis, surfaceId: x.id, speed, latVel: 0, vh: 0, hitstop: 0,
    adhesion: sim.t.peel.adhesionMax, peelHeldPrev: false, peelBuf: 0, kickBuf: 0, travel: null, invuln: 0, canSlap: false });
  if (x.axis === "h") { p.lat = cross; p.h = x.h; } else { p.lat = x.wl!; p.h = cross; }
}

/** Every standing sample: each standable surface, every 8 m, centre (+ both edges on wide strands). */
export function densitySamples(course: Course): Array<{ x: Surface; s: number; cross: number }> {
  const out: Array<{ x: Surface; s: number; cross: number }> = [];
  for (const x of course.surfaces) {
    const s1 = Math.min(x.s1 - 3, course.finishS);
    for (let s = x.s0 + 2; s < s1; s += 8) {
      const crosses = x.axis === "h"
        ? (x.l1 - x.l0 >= 5 ? [(x.l0 + x.l1) / 2, x.l0 + 0.8, x.l1 - 0.8] : [(x.l0 + x.l1) / 2])
        : [x.h0! + 1, (x.h0! + x.h1!) / 2, x.h1! - 1];
      for (const c of crosses) out.push({ x, s, cross: c });
    }
  }
  return out;
}

export function reachFrom(sim: Sim, x: Surface, s: number, cross: number) {
  standOn(sim, x, s, cross, s / 32);
  return reachableTargets(sim);
}
