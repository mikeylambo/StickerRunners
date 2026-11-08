import { Course } from "../src/game/sim/Course";
import { Sim, type SimOptions } from "../src/game/sim/Sim";
import { phase0Stage } from "../data/stages/phase0";
import { simTuning, move } from "../config/tuning";
import type { InputFrame, SimEvent } from "../src/game/sim/types";

export function makeSim(opts: SimOptions = {}) {
  return new Sim(new Course(phase0Stage, move.ribbonWidth), simTuning, opts);
}

/** Put the player stuck on whatever top/underside surface contains (s, lat) at height h. */
export function place(sim: Sim, s: number, lat: number, h = 0, n: 1 | -1 = 1, speed = 32) {
  const x = sim.course.supportAt(s, lat, h, n);
  if (!x) throw new Error(`no surface at s=${s} lat=${lat} h=${h} n=${n}`);
  Object.assign(sim.p, { state: "stuck", s, lat, h, n, surfaceId: x.id, speed, latVel: 0, vh: 0, hitstop: 0,
    adhesion: sim.t.peel.adhesionMax, peelHeldPrev: false, peelBuf: 0, kickBuf: 0, travel: null, invuln: 0 });
}

export function run(sim: Sim, frames: number, input: Partial<InputFrame> | ((i: number) => Partial<InputFrame>)): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < frames; i++) {
    const f = typeof input === "function" ? input(i) : input;
    out.push(...sim.step({ steer: 0, peel: false, kick: false, ...f }));
  }
  return out;
}

export function runUntil(sim: Sim, max: number, input: (i: number) => Partial<InputFrame>, stop: (e: SimEvent[]) => boolean): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < max; i++) {
    const ev = sim.step({ steer: 0, peel: false, kick: false, ...input(i) });
    out.push(...ev);
    if (stop(ev)) break;
  }
  return out;
}
