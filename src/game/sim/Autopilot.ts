/**
 * Simple road-line bot for the gates: stays near the centre, peels over gaps and blades, slaps back
 * onto clean road, and taps kick-off on long clean straights. It never takes debris lines — those are
 * covered by scripted scenario tests. Produces the same InputFrame a player would.
 */
import type { Sim } from "./Sim";
import { DT } from "./Sim";
import type { InputFrame } from "./types";

export class Autopilot {
  private kickHeld = false;
  constructor(private readonly sim: Sim) {}

  private dangerIn(s0: number, s1: number): boolean {
    const c = this.sim.course;
    for (let s = s0; s <= s1; s += 0.5) if (c.inGap(s) || c.hazardAt(s, 0, 3)) return true;
    return false;
  }

  decide(): InputFrame {
    const p = this.sim.p;
    const steer = Math.max(-1, Math.min(1, (0 - p.lat) * 0.6));
    const ahead = p.speed * DT * 9 + 1; // peel ~9 frames before danger
    let peel: boolean;
    let kick = false;
    if (p.state === "stuck" || p.state === "coyote" || p.state === "start") {
      peel = p.state !== "start" && this.dangerIn(p.s, p.s + ahead);
      const clean = !this.dangerIn(p.s, p.s + 120);
      const wantKick = p.state === "stuck" && clean && p.speed < 40;
      kick = wantKick && !this.kickHeld;
      this.kickHeld = wantKick && !this.kickHeld;
    } else if (p.state === "peeled") {
      const travel = p.speed * DT * 4;
      // hold until the landing zone (this tick's travel + a few metres) is clean road
      peel = this.dangerIn(p.s - 1, p.s + travel + 4) && p.adhesion > 0.05;
    } else if (p.state === "falling") {
      peel = false;
    } else {
      // slapTravel / respawning / finished: keep whatever we were doing
      peel = p.peelHeldPrev;
    }
    return { steer, peel, kick };
  }
}
