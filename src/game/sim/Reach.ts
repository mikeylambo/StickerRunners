/**
 * Reachability probe: which surfaces can Tack slap onto within ONE peel from its current state?
 * Runs the real sim on throwaway clones: peel now, steer {-1…+1}, release after 3…90 ticks (≤ 1.5 s
 * adhesion), and records every surface a slap lands on. Used by the density gate and by ?tells.
 */
import type { Sim } from "./Sim";

const STEERS = [-1, -0.5, 0, 0.5, 1];

export function reachableTargets(sim: Sim, opts: { excludeOrigin?: boolean; releaseStep?: number } = {}): Set<number> {
  const out = new Set<number>();
  const origin = sim.p.surfaceId;
  const step = opts.releaseStep ?? 4;
  for (const steer of STEERS) {
    for (let rel = 3; rel <= 90; rel += step) {
      const c = sim.clone();
      c.p.peelHeldPrev = false; c.p.peelBuf = 0; c.p.hitstop = 0;
      let done = false;
      for (let i = 0; i < rel + 8 && !done; i++) {
        for (const e of c.step({ steer, peel: i < rel, kick: false })) {
          if (e.type === "slap") { out.add(e.surfaceId); done = true; }
          if (e.type === "whiff" || e.type === "fall") done = true;
        }
      }
    }
  }
  sim.course.update(sim.time); // clones moved the shared course; pose it back for the live sim
  if (opts.excludeOrigin !== false) out.delete(origin);
  return out;
}
