/**
 * Sim invariants (CLAUDE.md Process): slap keeps ≥ 90% speed; player never off-track while stuck;
 * the ribbon is completable start to end. Seeded, so failures reproduce.
 */
import { describe, expect, test } from "vitest";
import { tunables } from "@slu/web-shell/tuning";
import { Autopilot } from "../src/game/sim/Autopilot";
import { mulberry32 } from "../src/game/sim/rng";
import { slap, move } from "../config/tuning";
import { makeSim, place, runUntil } from "./helpers";

describe("LAW 1 — a slap preserves ≥ 90% of entry speed", () => {
  test("slapMomentumKeep cannot be tuned below 0.90", () => {
    const before = slap.slapMomentumKeep;
    tunables.set("sr.slap", "slapMomentumKeep", 0.5);
    expect(slap.slapMomentumKeep).toBeGreaterThanOrEqual(0.9);
    tunables.set("sr.slap", "slapMomentumKeep", before);
  });

  test("400 seeded peel→slap trials from road and debris, at every speed, keep ≥ 90%", () => {
    const rnd = mulberry32(0x5717c3);
    const sim = makeSim();
    const starts = sim.course.surfaces.filter((x) => x.n === 1 && x.s1 - x.s0 > 20 && x.s0 < 1950);
    let slaps = 0;
    for (let trial = 0; trial < 400; trial++) {
      sim.reset();
      const x = starts[Math.floor(rnd() * starts.length)];
      const s = x.s0 + 2 + rnd() * Math.min(40, x.s1 - x.s0 - 4);
      const lat = x.l0 + 0.4 + rnd() * (x.l1 - x.l0 - 1);
      const speed = 2 + rnd() * (move.absCap - 2);
      place(sim, s, lat, x.h, 1, speed);
      const hold = 1 + Math.floor(rnd() * 80);
      const steer = rnd() * 2 - 1;
      const ev = runUntil(sim, 400, (i) => ({ peel: i < hold, steer }), (e) => e.some((k) => k.type === "slap" || k.type === "whiff" || k.type === "fallout"));
      for (const e of ev) {
        if (e.type !== "slap") continue;
        slaps++;
        expect(e.exitSpeed / e.entrySpeed).toBeGreaterThanOrEqual(0.9);
      }
    }
    expect(slaps).toBeGreaterThan(200); // the property was actually exercised
  });

  test("slap keeps ≥ 90% even at the locked floor (0.90) and at absCap", () => {
    const before = slap.slapMomentumKeep;
    tunables.set("sr.slap", "slapMomentumKeep", 0.9);
    const sim = makeSim();
    place(sim, 100, 0, 0, 1, move.absCap);
    const ev = runUntil(sim, 200, (i) => ({ peel: i < 10 }), (e) => e.some((k) => k.type === "slap"));
    const s = ev.find((e) => e.type === "slap");
    expect(s && s.type === "slap" && s.exitSpeed / s.entrySpeed).toBeGreaterThanOrEqual(0.9);
    tunables.set("sr.slap", "slapMomentumKeep", before);
  });
});

describe("full ribbon, autopilot", () => {
  test("runs start to finish with no fall-outs, every slap ≥ 90%, never off-track while stuck", () => {
    const sim = makeSim();
    const bot = new Autopilot(sim);
    let offTrackTicks = 0; let overCap = 0;
    for (let i = 0; i < 60 * 180 && !sim.finished; i++) {
      for (const e of sim.step(bot.decide())) {
        if (e.type === "slap") expect(e.exitSpeed / e.entrySpeed).toBeGreaterThanOrEqual(0.9);
      }
      if (!sim.stuckInvariantOk()) offTrackTicks++;
      if (sim.p.speed > move.absCap + 1e-9) overCap++;
    }
    expect(sim.finished).toBe(true);
    expect(sim.stats.falls).toBe(0);
    expect(sim.stats.slaps).toBeGreaterThanOrEqual(5); // at least one per gap
    expect(offTrackTicks).toBe(0);
    expect(overCap).toBe(0);
    expect(sim.finishTime).toBeLessThan(90);
  });

  test("seeded random play never breaks the stuck invariant or the speed caps", () => {
    const rnd = mulberry32(42);
    const sim = makeSim();
    let held = false; let steer = 0;
    for (let i = 0; i < 60 * 240 && !sim.finished; i++) {
      if (rnd() < 0.04) held = !held;
      if (rnd() < 0.05) steer = rnd() * 2 - 1;
      for (const e of sim.step({ steer, peel: held, kick: rnd() < 0.02 })) {
        if (e.type === "slap") expect(e.exitSpeed / e.entrySpeed).toBeGreaterThanOrEqual(0.9);
      }
      expect(sim.stuckInvariantOk()).toBe(true);
      expect(sim.p.speed).toBeLessThanOrEqual(move.absCap + 1e-9);
    }
  });
});
