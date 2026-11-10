/**
 * Phase 0c "web" test section (?stage=web): ~20 s of dense surfaces, greybox, flat colours.
 *
 * The world runs downhill (peel only hovers 0.9 m, never climbs), so height is gained only by riding
 * the wall or the lift platform. Track space: +lateral = rail side (screen lower-right), − = void side.
 *
 * SAFE line (wide railed strands, 3 transfers, blade fields to hop or eat):
 *   A (h 3) → B (h 1.5) → C (h 0) → D (h −2, finish)
 * FAST line (clean narrow strands, 7 transfers, kick-off friendly):
 *   A → F1 (h 2.2, void side) → WALL (ride it down) → P1 (slides sideways) → B's UNDERSIDE (under B's blades)
 *     → F3 (h −1, rail side) → P2 (lifts up/down) → D
 * Generated flanking lanes (±7, ±14) and a low layer under B make it dense: every standing point has ≥ 2 other
 * surfaces reachable within one peel (tests/web.test.ts probes it with the real sim).
 */
import type { StageDef, StrandDef } from "../../src/game/sim/Course";

const blades = (from: number, to: number, step: number, h: number, l0 = -3, l1 = 3) => {
  const out = [];
  for (let s = from; s <= to; s += step) out.push({ s0: s, s1: s + 1.2, l0, l1, height: 0.6, h });
  return out;
};

/** Centre (safe) strand height at s — the flanking lanes sit just below it so every lane can reach a neighbour. */
const centreH = (s: number) => (s < 276 ? 3 : s < 446 ? 1.5 : s < 600 ? 0 : -2);

/**
 * Flanking lanes at lateral ±7 and ±14: ~45 m segments with short gaps, each a different flat colour,
 * 0.4 m (±7) / 0.8 m (±14) below the centre strand where the segment starts. A segment can always reach
 * its lateral neighbour and its own successor ahead, which is what makes the web dense.
 * Skipped where a fast-line surface already lives (F1, wall, P1, U-layer, F3, P2).
 */
function lanes(): StrandDef[] {
  const out: StrandDef[] = [];
  const palette = ["#b8a35a", "#c46a7f", "#a8c25a", "#c27a4f", "#9a7fc9", "#5fa39a", "#c9835f", "#7fa3c9", "#a36b5f", "#6bb08a", "#c29a6b", "#8a9fd1"];
  const skip: Record<string, Array<[number, number]>> = {
    "-7": [[80, 220], [280, 430]], "-14": [[185, 330]], "7": [[290, 610]], "14": []
  };
  let k = 0;
  for (const lat of [-14, -7, 7, 14]) {
    const off = Math.abs(lat) > 10 ? 0.6 : 0.4;
    for (let s0 = 10 + (lat > 0 ? 18 : 0) + (Math.abs(lat) > 10 ? 9 : 0); s0 < 760; s0 += 52) {
      const s1 = s0 + 44;
      if ((skip[String(lat)] ?? []).some(([a, b]) => s1 > a && s0 < b)) continue;
      out.push({ name: `L${lat > 0 ? "R" : "V"}${Math.abs(lat)}-${Math.round(s0)}`, kind: "platform", s0, s1, lat, width: 3.5,
        h: Math.min(centreH(s0), centreH(s1)) - off, color: palette[k++ % palette.length], thickness: 0.5 });
    }
  }
  return out;
}

const strands: StrandDef[] = [
  // safe line — wide, railed, blade fields
  { name: "A", s0: 0, s1: 270, lat: 0, width: 6, h: 3, color: "#7d88bd", rail: true },
  { name: "B", s0: 282, s1: 440, lat: 0, width: 6, h: 1.5, color: "#5f8fa0", rail: true, underside: { s0: 296, s1: 440 } },
  { name: "C", s0: 452, s1: 650, lat: 0, width: 6, h: 0, color: "#8f78b0", rail: true },
  { name: "D", s0: 610, s1: 860, lat: 1, width: 8, h: -2, color: "#6d82b8", rail: true },
  // fast line — narrow, clean
  { name: "F1", s0: 85, s1: 215, lat: -8, width: 4, h: 2.2, color: "#c9835f" },
  { name: "F3", s0: 425, s1: 562, lat: 8, width: 4, h: -1, color: "#5fa36b" },
  // moving platforms
  { name: "P1", kind: "platform", s0: 288, s1: 334, lat: -8, width: 4, h: -0.5, color: "#d4a24c", thickness: 0.5,
    motion: { axis: "lat", amp: 1.6, period: 5, phase: 0 } },
  { name: "P2", kind: "platform", s0: 560, s1: 606, lat: 7, width: 4, h: -1, color: "#4fb0a8", thickness: 0.5,
    motion: { axis: "h", amp: 0.7, period: 4, phase: 0 } },
  // a second, lower layer under B so riding B's underside has places to drop to
  { name: "U1", kind: "platform", s0: 336, s1: 424, lat: -7, width: 4, h: -0.6, color: "#c9b04f", thickness: 0.5 },
  { name: "U2", kind: "platform", s0: 300, s1: 420, lat: 7, width: 4, h: -0.4, color: "#b0688f", thickness: 0.5,
    motion: { axis: "lat", amp: 1, period: 6, phase: 1 } },
  { name: "U0", kind: "platform", s0: 330, s1: 432, lat: 0, width: 4, h: -1.2, color: "#7fa36b", thickness: 0.5 },
  // floors beside the wall, so leaving it is a choice: H1 is the up-and-over exit past the wall's top edge
  { name: "H1", kind: "platform", s0: 200, s1: 300, lat: -10.5, width: 3, h: 6.2, color: "#d08aa0", thickness: 0.5 },
  { name: "W1", kind: "platform", s0: 200, s1: 290, lat: -11, width: 3, h: 1.0, color: "#a36b9a", thickness: 0.5 },
  { name: "W2", kind: "platform", s0: 196, s1: 336, lat: -6, width: 3.5, h: 0.2, color: "#6b8fa3", thickness: 0.5 },
  { name: "W5", kind: "platform", s0: 268, s1: 322, lat: -12, width: 2.5, h: 0.9, color: "#9ac26b", thickness: 0.5 },
  { name: "W3", kind: "platform", s0: 236, s1: 300, lat: 1, width: 3.5, h: -0.3, color: "#c2a35f", thickness: 0.5 },
  { name: "F3c", kind: "platform", s0: 438, s1: 520, lat: -3, width: 3.5, h: -1.2, color: "#b07a5f", thickness: 0.5 },
  { name: "R14b", kind: "platform", s0: 556, s1: 600, lat: 18, width: 3.5, h: -2.4, color: "#6b9fb0", thickness: 0.5 },
  { name: "W6", kind: "platform", s0: 236, s1: 298, lat: 6, width: 3.5, h: -0.8, color: "#b0a36b", thickness: 0.5 },
  { name: "W7", kind: "platform", s0: 250, s1: 330, lat: 11, width: 3.5, h: -1.0, color: "#7a9fd1", thickness: 0.5 },
  { name: "R14c", kind: "platform", s0: 596, s1: 650, lat: 18, width: 3.5, h: -2.9, color: "#c28a6b", thickness: 0.5 },
  { name: "F3b", kind: "platform", s0: 425, s1: 472, lat: 3.5, width: 3.5, h: -1.6, color: "#9fb05f", thickness: 0.5 },
  // the finish strand's far neighbours
  { name: "D3", kind: "platform", s0: 600, s1: 662, lat: 11.5, width: 3.5, h: -2.6, color: "#c27a9a", thickness: 0.5 },
  { name: "D4", kind: "platform", s0: 660, s1: 770, lat: -11.5, width: 3.5, h: -2.9, color: "#7f9fca", thickness: 0.5 },
  { name: "D5", kind: "platform", s0: 670, s1: 770, lat: 11.5, width: 3.5, h: -2.7, color: "#a3c26b", thickness: 0.5 },
  ...lanes()
];

export const webStage: StageDef = {
  id: "web",
  road: false,
  roadThickness: 0.3,
  finishMargin: 150,
  startLat: 0,
  cameraHeightFollow: 0.6,
  segments: [
    { length: 330, turnDeg: 0 },
    { length: 200, turnDeg: 10 }, // one gentle bend so the strands read as a highway, not a grid
    { length: 330, turnDeg: 0 }
  ],
  elevation: () => 0,
  gaps: [],
  islands: [],
  underside: [],
  strands,
  walls: [{ name: "WALL", s0: 195, s1: 322, lat: -13.5, h0: 2, h1: 7, n: 1, color: "#8a6fd1" }],
  hazards: [
    ...blades(110, 262, 10, 3),   // A
    ...blades(298, 430, 10, 1.5), // B top (ride B's underside instead)
    ...blades(462, 642, 10, 0)    // C
  ]
};
