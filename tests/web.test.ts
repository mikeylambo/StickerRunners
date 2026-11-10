/**
 * Phase 0c web section gates: both lines finish clean, fast is ≥ 15% quicker with more transfers,
 * every slap keeps ≥ 90%, the stuck invariant holds, and the web is dense (≥ 2 other surfaces reachable
 * within one peel from every standing point, probed with the real sim at two moving-platform phases).
 */
import { describe, expect, test } from "vitest";
import { WebBot, type WebLine } from "../src/game/sim/WebBot";
import { reachableTargets } from "../src/game/sim/Reach";
import { makeWebSim, densitySamples, standOn } from "./webHelpers";

function runLine(line: WebLine) {
  const sim = makeWebSim();
  const bot = new WebBot(sim, line);
  const visited: string[] = [];
  let offTrack = 0; let minKeep = Infinity;
  for (let i = 0; i < 60 * 60 && !sim.finished; i++) {
    for (const e of sim.step(bot.decide())) {
      if (e.type === "slap") minKeep = Math.min(minKeep, e.exitSpeed / e.entrySpeed);
    }
    const x = sim.course.surface(sim.p.surfaceId);
    if ((sim.p.state === "stuck") && x?.name && visited[visited.length - 1] !== x.name) visited.push(x.name);
    if (!sim.stuckInvariantOk()) offTrack++;
  }
  return { sim, visited, offTrack, minKeep };
}

describe("web section (?stage=web)", () => {
  const safe = runLine("safe");
  const fast = runLine("fast");

  test("safe line: bot finishes, no falls, every slap ≥ 90%, never off-track while stuck", () => {
    expect(safe.sim.finished).toBe(true);
    expect(safe.sim.stats.falls).toBe(0);
    expect(safe.minKeep).toBeGreaterThanOrEqual(0.9);
    expect(safe.offTrack).toBe(0);
    expect(safe.visited.filter((n) => ["A", "B", "C", "D"].includes(n))).toEqual(["A", "B", "C", "D"]);
  });

  test("fast line: finishes clean through wall, moving platforms and an underside", () => {
    expect(fast.sim.finished).toBe(true);
    expect(fast.sim.stats.falls).toBe(0);
    expect(fast.minKeep).toBeGreaterThanOrEqual(0.9);
    expect(fast.offTrack).toBe(0);
    expect(fast.visited).toEqual(["A", "F1", "WALL", "P1", "B-under", "F3", "P2", "D"]);
  });

  test("fast line is ≥ 15% quicker and needs more transfers", () => {
    expect(fast.sim.finishTime).toBeLessThanOrEqual(safe.sim.finishTime * 0.85);
    expect(fast.visited.length - 1).toBeGreaterThan(safe.visited.length - 1);
    expect(fast.sim.finishTime).toBeGreaterThan(15); // ~20 s section
    expect(safe.sim.finishTime).toBeLessThan(30);
  });

  test("dense: ≥ 2 other surfaces reachable within one peel from every standing point (two platform phases)", () => {
    const sim = makeWebSim();
    const bad: string[] = [];
    for (const phase of [0, 2.5]) {
      for (const { x, s, cross } of densitySamples(sim.course)) {
        standOn(sim, x, s, cross, s / 32 + phase);
        const n = reachableTargets(sim).size;
        if (n < 2) bad.push(`${x.name}@${s.toFixed(0)}/${cross.toFixed(1)} t+${phase}: ${n}`);
      }
    }
    expect(bad).toEqual([]);
  }, 60_000);

  test("moving platforms carry a stuck Tack", () => {
    const sim = makeWebSim();
    const p1 = sim.course.byName("P1")!;
    standOn(sim, p1, 300, -8, 300 / 32);
    const lat0 = sim.p.lat;
    for (let i = 0; i < 30; i++) sim.step({ steer: 0, peel: false, kick: false });
    expect(Math.abs(sim.p.lat - lat0)).toBeGreaterThan(0.2);
    expect(sim.stuckInvariantOk()).toBe(true);
  });
});
