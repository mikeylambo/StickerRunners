/**
 * Phase 0 greybox ribbon: ~2,000 m, straight into gentle curves.
 * 5 pre-placed gaps, 10 debris islands in the void (lateral < 0 side), one road-underside section.
 *
 * TS instead of the GDD's data/stages/*.json so the elevation function and types stay checked
 * (DECISIONS.md). Units are metres in track space.
 */
import type { StageDef } from "../../src/game/sim/Course";

export const phase0Stage: StageDef = {
  id: "phase0-greybox",
  roadThickness: 0.3,
  finishMargin: 20,
  segments: [
    { length: 250, turnDeg: 0 },     // onboarding straight
    { length: 250, turnDeg: 25 },    // gentle left
    { length: 150, turnDeg: 0 },
    { length: 300, turnDeg: -40 },   // long right
    { length: 150, turnDeg: 0 },
    { length: 200, turnDeg: 30 },    // left into the underside section
    { length: 150, turnDeg: 0 },     // straight under/over section
    { length: 280, turnDeg: -35 },   // right
    { length: 150, turnDeg: 20 },    // left
    { length: 120, turnDeg: 0 }      // finish straight
  ],
  // gentle rolling hills (±8 m over 1 km, max slope ≈ 2.9°)
  elevation: (s) => 8 * Math.sin((s / 1000) * Math.PI * 2),
  gaps: [
    { s0: 300, s1: 314 },   // G1 14 m — first peel, trivially clearable
    { s0: 560, s1: 578 },   // G2 18 m
    { s0: 860, s1: 884 },   // G3 24 m — island I4 bridges it on the void side
    { s0: 1240, s1: 1262 }, // G4 22 m — right before the underside section
    { s0: 1660, s1: 1690 }  // G5 30 m — long; full peel or island I8
  ],
  islands: [
    { s0: 380, s1: 410, lat: -10, width: 5, h: -0.5 },  // I1 first free line
    { s0: 440, s1: 470, lat: -9, width: 5, h: 0 },      // I2 chain from I1
    { s0: 640, s1: 670, lat: -11, width: 5, h: -1 },    // I3
    { s0: 850, s1: 895, lat: -9, width: 5, h: -0.5 },   // I4 bridges G3
    { s0: 1000, s1: 1030, lat: -10, width: 5, h: 0.3 }, // I5
    { s0: 1062, s1: 1092, lat: -14, width: 5, h: -1.5 },// I6 chain from I5, further out
    { s0: 1268, s1: 1304, lat: -8, width: 5, h: -3.2 }, // U1 low: entry to the underside line
    { s0: 1520, s1: 1550, lat: -10, width: 5, h: -0.5 },// I7
    { s0: 1650, s1: 1700, lat: -9, width: 5, h: -0.8 }, // I8 bridges G5
    { s0: 1800, s1: 1830, lat: -11, width: 5, h: 0 }    // I9
  ],
  // Riding beneath the road skips the blade row on top. Fold round the void edge to get back up.
  underside: [{ s0: 1295, s1: 1420 }],
  // Static full-width blades on top of the underside section: peel-hop them, eat the hits, or go under.
  hazards: [1310, 1325, 1340, 1355, 1370, 1385, 1400].map((s) => ({ s0: s, s1: s + 1.2, l0: -3, l1: 3, height: 0.6 }))
};
