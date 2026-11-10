/**
 * Route bot for the web stage. Follows a named line surface by surface and plays it the way a player
 * would: steer toward the next surface, peel at the leave point, hold the steer, release the moment the
 * slap the sim would pick IS the next surface. Hops blades on the current strand. Kicks on clean stretches.
 * Same InputFrame as a player; no sim shortcuts.
 */
import type { Sim } from "./Sim";
import { DT } from "./Sim";
import type { Surface } from "./Course";
import type { InputFrame } from "./types";

export type WebLine = "safe" | "fast";

interface Leg { on: string; to?: string; leave?: number; steer?: number; cross?: number }

export const WEB_ROUTES: Record<WebLine, Leg[]> = {
  // leave = s to peel at (undefined = when the surface is about to end); steer = held while peeled;
  // cross = target lateral (floors) or height (walls) to ride at before leaving.
  safe: [
    { on: "A", to: "B", cross: 0 },
    { on: "B", to: "C", cross: 0 },
    { on: "C", to: "D", cross: 0 },
    { on: "D", cross: 0.5 }
  ],
  fast: [
    { on: "A", to: "F1", leave: 86, steer: -1, cross: -2.4 },
    { on: "F1", to: "WALL", leave: 200, steer: -1, cross: -9.4 },
    { on: "WALL", to: "P1", leave: 297, steer: 1, cross: 2.6 },
    { on: "P1", to: "B-under", leave: 300, steer: 1 },
    { on: "B-under", to: "F3", leave: 424, steer: 1, cross: 2.4 },
    { on: "F3", to: "P2", leave: 556, steer: -0.3, cross: 7.5 },
    { on: "P2", to: "D", leave: 612, steer: -1, cross: 6 },
    { on: "D", cross: 2 }
  ]
};

export class WebBot {
  private leg = 0;
  private kickHeld = false;
  private peeledTicks = 0;
  constructor(private readonly sim: Sim, readonly line: WebLine) {}

  private surf(name: string | undefined): Surface | undefined { return name ? this.sim.course.byName(name) : undefined; }

  private hazardAhead(x: Surface, s0: number, s1: number): boolean {
    if (x.axis !== "h" || x.n !== 1) return false;
    const c = this.sim.course;
    for (let s = s0; s <= s1; s += 0.5) if (c.hazardAt(s, this.sim.p.lat, 0.3, x.h)) return true;
    return false;
  }

  decide(): InputFrame {
    const sim = this.sim; const p = sim.p; const route = WEB_ROUTES[this.line];
    const cur = sim.course.surface(p.surfaceId);
    const at = route.findIndex((l, i) => i >= this.leg && l.on === cur?.name);
    if (at >= 0 && (p.state === "stuck" || p.state === "coyote")) this.leg = at;
    const leg = route[this.leg];
    const next = this.surf(leg.to);
    const ahead = p.speed * DT * 9 + 1;
    let steer = 0; let peel = false; let kick = false;
    this.peeledTicks = p.state === "peeled" ? this.peeledTicks + 1 : 0;

    if ((p.state === "stuck" || p.state === "coyote" || p.state === "start") && cur) {
      if (leg.cross !== undefined) {
        steer = cur.axis === "h" ? (leg.cross - p.lat) * 0.6 : -(leg.cross - p.h) * 0.6;
        steer = Math.max(-1, Math.min(1, steer));
      }
      const ending = cur.s1 - p.s < ahead;
      const leaving = leg.leave !== undefined && p.s >= leg.leave;
      const hop = this.hazardAhead(cur, p.s, p.s + ahead);
      peel = p.state !== "start" && (leaving || ending || hop);
      if (peel && leaving) steer = leg.steer ?? steer;
      const clean = !this.hazardAhead(cur, p.s, p.s + 60) && cur.s1 - p.s > 60;
      const want = p.state === "stuck" && clean && p.speed < 40 && !peel;
      kick = want && !this.kickHeld;
      this.kickHeld = want && !this.kickHeld;
    } else if (p.state === "peeled" || (p.state === "falling" && p.canSlap)) {
      const transferring = !!next && (p.s >= (leg.leave ?? Infinity) || (cur && cur.s1 - p.s < 12));
      steer = transferring ? (leg.steer ?? 0) : 0;
      const t = sim.previewSlap(steer);
      let release = false;
      if (t && (this.peeledTicks >= 5 || p.state === "falling")) { // let the lift happen before judging the cone
        const landClean = !this.hazardAhead(t.surface, t.s - 0.5, t.s + p.speed * DT * 6 + 1);
        if (transferring) release = t.surface === next;
        else release = (t.surface === cur || t.surface === next) && landClean; // hop landed past the blade
      }
      if (p.adhesion < 0.08) release = true; // out of adhesion: take what the cone gives
      peel = !release;
    } else if (p.state === "slapTravel" || p.state === "respawning" || p.state === "finished") {
      peel = false;
    }
    return { steer, peel, kick };
  }
}
