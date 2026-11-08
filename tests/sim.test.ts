/** Unit tests for movement rules: coyote, buffer, kick-off, debris & underside slaps, whiff, fall-out. */
import { describe, expect, test } from "vitest";
import { input, move, peel, fall } from "../config/tuning";
import { makeSim, place, run, runUntil } from "./helpers";
import type { SimEvent } from "../src/game/sim/types";

const has = (ev: SimEvent[], t: SimEvent["type"]) => ev.some((e) => e.type === t);

describe("auto-run", () => {
  test("accelerates 0 → topSpeed in ~1.6 s after the 0.3 s press-on", () => {
    const sim = makeSim();
    run(sim, Math.round((0.3 + move.accelTime) * 60) + 2, {});
    expect(sim.p.speed).toBeCloseTo(move.topSpeed, 5);
  });

  test("rail side is solid", () => {
    const sim = makeSim();
    place(sim, 100, 0);
    run(sim, 60, { steer: 1 });
    expect(sim.p.state).toBe("stuck");
    expect(sim.p.lat).toBeCloseTo(3 - move.tackHalfWidth, 6);
  });
});

describe("coyote (6f off the void edge)", () => {
  const edgeOff = () => {
    const sim = makeSim();
    place(sim, 100, -2.69);
    const ev = runUntil(sim, 30, () => ({ steer: -1 }), (e) => has(e, "coyote"));
    expect(has(ev, "coyote")).toBe(true);
    return sim;
  };
  test("peel within the coyote window works", () => {
    const sim = edgeOff();
    const ev = run(sim, input.coyoteFrames - 1, {});
    expect(has(ev, "fall")).toBe(false);
    expect(has(run(sim, 1, { peel: true }), "peel")).toBe(true);
  });
  test("after the window you fall", () => {
    const sim = edgeOff();
    const ev = run(sim, input.coyoteFrames, {});
    expect(has(ev, "fall")).toBe(true);
    expect(has(run(sim, 1, { peel: true }), "peel")).toBe(false);
  });
});

describe("buffer (5f)", () => {
  test("a peel pressed during slap hitstop fires when hitstop ends", () => {
    const sim = makeSim();
    place(sim, 100, 0);
    runUntil(sim, 120, (i) => ({ peel: i < 5 }), (e) => has(e, "slap"));
    expect(sim.p.hitstop).toBeGreaterThan(0);
    const ev = run(sim, input.bufferFrames, (i) => ({ peel: i >= 1 }));
    expect(has(ev, "peel")).toBe(true);
  });
  test("a press older than 5f is dropped", () => {
    const sim = makeSim();
    place(sim, 100, 0);
    // press during start state, then keep holding: buffered press expires before we're stuck
    sim.reset();
    const ev = run(sim, 25, { peel: true });
    expect(has(ev, "peel")).toBe(false);
  });
});

describe("peel", () => {
  test("lifts to peel height in a few frames, drains adhesion 1.0/s, decays forward speed 4%/s", () => {
    const sim = makeSim();
    place(sim, 100, 0, 0, 1, 32);
    run(sim, 30, { peel: true });
    expect(sim.p.state).toBe("peeled");
    expect(sim.p.h).toBeGreaterThan(peel.peelHeight * 0.99);
    expect(sim.p.adhesion).toBeCloseTo(peel.adhesionMax - (29 / 60) * peel.adhesionDrain, 6); // press tick lifts, 29 ticks drain
    expect(sim.p.speed).toBeCloseTo(32 * Math.pow(1 - peel.forwardDecay / 60, 29), 6);
  });
  test("adhesion running out drops you; ground hazards pass beneath while peeled", () => {
    const sim = makeSim();
    place(sim, 1300, 0, 0, 1, 32); // blade row starts at 1310
    const ev = run(sim, 60, { peel: true });
    expect(has(ev, "hazard")).toBe(false);
    const ev2 = run(sim, 60, { peel: true });
    expect(has(ev2, "fall")).toBe(true);
  });
  test("riding the road top through the blade row costs speed", () => {
    const sim = makeSim();
    place(sim, 1300, 0, 0, 1, 32);
    const ev = run(sim, 40, {});
    expect(has(ev, "hazard")).toBe(true);
  });
});

describe("slap", () => {
  test("refills adhesion, applies hitstop, snaps in 3 frames", () => {
    const sim = makeSim();
    place(sim, 100, 0);
    run(sim, 30, { peel: true });
    const ev = run(sim, 3, {});
    const s = ev.find((e) => e.type === "slap");
    expect(s).toBeTruthy();
    expect(sim.p.adhesion).toBe(peel.adhesionMax);
    expect(sim.p.hitstop).toBe(4);
  });

  test("slap onto a debris island from the road", () => {
    const sim = makeSim();
    place(sim, 372, -2.6);
    // I1: s 380–410, lat -12.5…-7.5. Peel, drift left toward the island, release once it is in the cone.
    const ev = runUntil(sim, 200, () => ({ peel: sim.p.lat > -5.5, steer: -1 }), (e) => has(e, "slap") || has(e, "whiff"));
    const s = ev.find((e) => e.type === "slap");
    expect(s && s.type === "slap" && s.surface).toBe("island");
    expect(sim.p.state === "stuck" || sim.p.hitstop > 0).toBe(true);
  });

  test("underside line: low island → slap up onto the road underside → ride under the blades → fold back on top", () => {
    const sim = makeSim();
    place(sim, 1280, -8, -3.2);
    const ev = runUntil(sim, 300, () => ({ peel: sim.p.lat < -1.5, steer: 1 }), (e) => has(e, "slap") || has(e, "whiff"));
    const s = ev.find((e) => e.type === "slap");
    expect(s && s.type === "slap" && s.surface).toBe("underside");
    expect(sim.p.n).toBe(-1);
    // ride beneath the blade row
    // blades end at 1401.2, underside ends at 1420: fold round the void edge in between
    const under = runUntil(sim, 60 * 5, () => ({ steer: sim.p.s > 1403 ? -1 : 0 }), (e) => has(e, "wrap"));
    expect(has(under, "hazard")).toBe(false);
    expect(has(under, "wrap")).toBe(true);
    expect(sim.p.n).toBe(1);
    expect(sim.p.state).toBe("stuck");
  });

  test("no surface in the cone = whiff, keep falling", () => {
    const sim = makeSim();
    place(sim, 1065, -14, -1.5); // I6 is the furthest-out island
    const ev = runUntil(sim, 200, () => ({ peel: sim.p.lat > -26, steer: -1 }), (e) => has(e, "slap") || has(e, "whiff"));
    expect(has(ev, "whiff")).toBe(true);
    expect(sim.p.state).toBe("falling");
  });
});

describe("kick-off", () => {
  test("bursts toward 44 m/s and never past it", () => {
    const sim = makeSim();
    place(sim, 100, 0, 0, 1, 32);
    let max = 0;
    for (let i = 0; i < 120; i++) { sim.step({ steer: 0, peel: false, kick: i % 2 === 0 }); max = Math.max(max, sim.p.speed); }
    expect(max).toBeGreaterThan(40);
    expect(max).toBeLessThanOrEqual(move.kickoffCap + 1e-9);
  });
  test("only while stuck", () => {
    const sim = makeSim();
    place(sim, 100, 0);
    run(sim, 10, { peel: true });
    expect(has(run(sim, 3, { peel: true, kick: true }), "kick")).toBe(false);
  });
});

describe("fall-out", () => {
  test("1.0 s off-screen respawns on the road after a 1.0 s re-stick", () => {
    const sim = makeSim();
    place(sim, 297, 0); // run straight into G1 without peeling
    const ev = runUntil(sim, 60 * 6, () => ({}), (e) => has(e, "respawn"));
    expect(has(ev, "fall")).toBe(true);
    expect(has(ev, "fallout")).toBe(true);
    expect(sim.p.state).toBe("respawning");
    expect(sim.course.inGap(sim.p.s)).toBe(false);
    const ev2 = run(sim, Math.round(fall.restickTime * 60), {});
    expect(has(ev2, "restick")).toBe(true);
    expect(sim.p.state).toBe("stuck");
  });

  test("?god: gaps are solid, adhesion does not drain", () => {
    const sim = makeSim({ god: true });
    place(sim, 297, 0);
    const ev = run(sim, 60, {});
    expect(has(ev, "fall")).toBe(false);
    run(sim, 1, { peel: true });
    run(sim, 200, { peel: true });
    expect(sim.p.adhesion).toBe(peel.adhesionMax);
  });
});

describe("track", () => {
  test("is ~2,000 m with orthonormal frames", () => {
    const sim = makeSim();
    const tr = sim.course.track;
    expect(tr.length).toBeGreaterThanOrEqual(1900);
    expect(tr.length).toBeLessThanOrEqual(2100);
    for (let s = 0; s < tr.length; s += 37) {
      const f = tr.frameAt(s);
      const dot = (a: typeof f.T, b: typeof f.T) => a.x * b.x + a.y * b.y + a.z * b.z;
      expect(Math.abs(dot(f.T, f.R))).toBeLessThan(1e-9);
      expect(Math.abs(dot(f.T, f.U))).toBeLessThan(1e-9);
      expect(Math.abs(dot(f.R, f.U))).toBeLessThan(1e-9);
      expect(f.U.y).toBeGreaterThan(0.99); // gentle hills only
    }
  });
  test("has 5 gaps, 10 debris islands and an underside section", () => {
    const c = makeSim().course;
    expect(c.gaps.length).toBe(5);
    expect(c.surfaces.filter((x) => x.kind === "island").length).toBe(10);
    expect(c.surfaces.filter((x) => x.kind === "underside").length).toBeGreaterThanOrEqual(1);
  });
});
