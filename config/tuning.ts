/**
 * Sticker Runners — all tuning lives here (CLAUDE.md law). Every value carries a `// why`.
 *
 * Values are registered with the Shell's TunableRegistry so the backtick panel edits them live.
 * The schema default is the source of truth; `tuning/<group>.json` only exists if someone
 * presses Save in the panel, and then becomes canon (see DECISIONS.md).
 *
 * LOCKED values have their min pinned so the panel cannot break a Law.
 */
import { tunables } from "@slu/web-shell/tuning";

export const move = tunables.define("sr.move", {
  // why: GDD §31 — road crosses the screen diagonal in ~1.2 s at this speed.
  topSpeed: { min: 10, max: 55, step: 0.5, default: 32, label: "top speed m/s" },
  // why: GDD §9 — 0→32 in 1.6 s. Expressed as seconds so the feel number is what we tune.
  accelTime: { min: 0.2, max: 4, step: 0.05, default: 1.6, label: "0→top s" },
  // why: GDD §31 — rewards Kick-off without breaking reads.
  kickoffCap: { min: 32, max: 55, step: 0.5, default: 44, label: "kick-off cap m/s" },
  // why: Kick-off is a burst, not a set-speed. +8 m/s is ~1.5 presses from top to cap. (DECISIONS)
  kickoffImpulse: { min: 1, max: 20, step: 0.5, default: 8, label: "kick-off impulse m/s" },
  // why: stops kick-off from being mashed every frame; still allows double-tap to cap. (DECISIONS)
  kickoffCooldown: { min: 0, max: 2, step: 0.05, default: 0.35, label: "kick-off cooldown s" },
  // why: overspeed above topSpeed bleeds so kick-off is a decision, not a permanent state. (DECISIONS)
  overspeedBleed: { min: 0, max: 20, step: 0.5, default: 3, label: "overspeed bleed m/s²" },
  // why: GDD §31 — absolute ceiling for any combination of effects.
  absCap: { min: 44, max: 80, step: 1, default: 55, label: "absolute cap m/s" },
  // why: GDD §9 — lateral steer 9 m/s.
  lateralSpeed: { min: 2, max: 20, step: 0.5, default: 9, label: "lateral m/s" },
  // why: GDD §9 — 0.08 s to full lateral speed.
  lateralRampTime: { min: 0.01, max: 0.5, step: 0.01, default: 0.08, label: "lateral ramp s" },
  // why: GDD §16 — the ribbon's narrowness is sacred: 6 m.
  ribbonWidth: { min: 3, max: 12, step: 0.25, default: 6, label: "ribbon width m (rebuild)" },
  // why: GDD §11 hurtbox is 0.6 m wide; half of it keeps Tack's body inside the rail.
  tackHalfWidth: { min: 0.05, max: 1, step: 0.05, default: 0.3, label: "Tack half-width m" },
  // why: a static road obstacle costs 30% speed (GDD §9). Outline loss is NOT in Phase 0.
  hazardSpeedKeep: { min: 0.1, max: 1, step: 0.05, default: 0.7, label: "hazard speed keep" },
  // why: GDD §11 — 0.8 s invulnerability after any hit.
  hazardInvuln: { min: 0, max: 3, step: 0.1, default: 0.8, label: "hazard invuln s" }
});

export const peel = tunables.define("sr.peel", {
  // why: GDD §31 — long enough for 1 gap + 1 decision.
  adhesionMax: { min: 0.3, max: 4, step: 0.05, default: 1.5, label: "adhesion max s" },
  // why: GDD §12 — drains 1.0/s while peeled.
  adhesionDrain: { min: 0.1, max: 3, step: 0.05, default: 1.0, label: "adhesion drain /s" },
  // why: GDD §9 — forward speed decays 4%/s while peeled.
  forwardDecay: { min: 0, max: 0.3, step: 0.005, default: 0.04, label: "forward decay /s" },
  // why: GDD §9 — 70% lateral control while peeled.
  lateralControl: { min: 0.1, max: 1, step: 0.05, default: 0.7, label: "peeled lateral control" },
  // why: hover gap off the surface. Must clear 0.6 m hazards (GDD §11 hurtbox ~0.9 m tall). (DECISIONS)
  peelHeight: { min: 0.2, max: 3, step: 0.05, default: 0.9, label: "peel height m" },
  // why: GDD §10 — peel startup is 2 frames; 0.035 s time constant reaches ~60% in 2f. (DECISIONS)
  liftTime: { min: 0.005, max: 0.3, step: 0.005, default: 0.035, label: "lift time-constant s" },
  // why: GDD §9 — gravity 6 m/s² once adhesion is gone (falling).
  gravity: { min: 1, max: 30, step: 0.5, default: 6, label: "fall gravity m/s²" },
  // why: GDD §12 — at 0.3 s adhesion left the edge flutters.
  flutterAt: { min: 0, max: 1, step: 0.05, default: 0.3, label: "flutter at s left" }
});

export const slap = tunables.define("sr.slap", {
  // why: LAW 1 / Pillar 3 — LOCKED ≥ 0.90. Panel min is pinned at 0.90 so tuning cannot break the law.
  slapMomentumKeep: { min: 0.9, max: 1, step: 0.01, default: 0.92, label: "momentum keep (LOCKED ≥0.90)" },
  // why: GDD §31 — generous, Celeste-style forgiveness.
  slapConeDeg: { min: 5, max: 90, step: 1, default: 35, label: "slap cone °" },
  // why: max slap reach. 3f snap over 8 m reads as a smack, not a teleport. (DECISIONS)
  slapRange: { min: 2, max: 20, step: 0.5, default: 8, label: "slap range m" },
  // why: handoff step 6 — snap within 3 frames.
  snapFrames: { min: 1, max: 10, step: 1, default: 3, label: "snap frames" },
  // why: GDD §10 Impact Scale — Slap tier hitstop 4f.
  hitstopFrames: { min: 0, max: 12, step: 1, default: 4, label: "hitstop frames" },
  // why: aim axis weights in track space (forward, lateral-from-stick, toward-plane). (DECISIONS)
  aimForward: { min: 0, max: 2, step: 0.05, default: 0.35, label: "aim forward weight" },
  aimVertical: { min: 0, max: 2, step: 0.05, default: 0.45, label: "aim toward-plane weight" }
});

export const input = tunables.define("sr.input", {
  // why: LOCKED — Celeste calibration, GDD §8/§31.
  bufferFrames: { min: 5, max: 5, step: 1, default: 5, label: "buffer frames (LOCKED)" },
  // why: GDD §31 — coyote 6f off any void edge.
  coyoteFrames: { min: 0, max: 20, step: 1, default: 6, label: "coyote frames" },
  // why: GDD §8 — 0.2 analog deadzone.
  deadzone: { min: 0, max: 0.6, step: 0.01, default: 0.2, label: "stick deadzone" }
});

export const fall = tunables.define("sr.fall", {
  // why: "off-screen" in sim terms — this far below the sheet you are behind the page. (DECISIONS)
  falloutDepth: { min: 0.5, max: 20, step: 0.5, default: 2.5, label: "fall-out depth m" },
  // why: handoff step 8 — 1.0 s off-screen = fall-out.
  falloutTime: { min: 0.1, max: 3, step: 0.05, default: 1.0, label: "fall-out time s" },
  // why: handoff step 8 / GDD §6 — 1.0 s re-stick.
  restickTime: { min: 0.1, max: 3, step: 0.05, default: 1.0, label: "re-stick s" },
  // why: a fall is a mistake and may cost speed, but not a full standstill. (DECISIONS)
  respawnSpeed: { min: 0, max: 40, step: 1, default: 16, label: "respawn speed m/s" },
  // why: respawn this far before the fall point so the player retries the obstacle. (DECISIONS)
  respawnBack: { min: 0, max: 80, step: 1, default: 25, label: "respawn back m" }
});

export const camera = tunables.define("sr.camera", {
  // why: GDD §15 — narrow-FOV perspective, near-orthographic.
  fov: { min: 5, max: 70, step: 0.5, default: 22, label: "FOV °" },
  // why: GDD §15 — pitch 38°.
  pitchDeg: { min: 10, max: 80, step: 0.5, default: 38, label: "pitch °" },
  // why: GDD §15 — track yaw 30°; road runs bottom-left → top-right.
  yawDeg: { min: 0, max: 80, step: 0.5, default: 30, label: "track yaw °" },
  // why: sets on-screen road length. 110 m = exactly 2.0 s of road ahead at top speed (GDD §16 sightline,
  // §15 priority #1). The GDD's "crosses the diagonal in 1.2 s" needs ~55 m and loses the sightline. (DECISIONS)
  distance: { min: 20, max: 300, step: 1, default: 110, label: "distance m" },
  // why: GDD §15 — lead by 0.25 s of speed.
  leadTime: { min: 0, max: 1, step: 0.01, default: 0.25, label: "lead s" },
  // why: puts Tack at ~35% from bottom-left (screen centre sits this far ahead). Tuned by screenshot.
  leadBase: { min: -20, max: 40, step: 0.5, default: 4, label: "lead base m" },
  // why: GDD §15 — critically damped 0.12 s.
  smoothTime: { min: 0.01, max: 1, step: 0.01, default: 0.12, label: "smooth s" },
  // why: heading follows the track so curves keep the diagonal; slower than position to avoid swim.
  yawSmoothTime: { min: 0.05, max: 3, step: 0.05, default: 0.6, label: "heading smooth s" },
  // why: camera follows lateral position partially so the 6 m ribbon stays framed. (DECISIONS)
  lateralFollow: { min: 0, max: 1, step: 0.05, default: 0.5, label: "lateral follow" }
});

export const feel = tunables.define("sr.feel", {
  // why: GDD §10 — Slap tier shake 3 px.
  slapShakePx: { min: 0, max: 12, step: 0.5, default: 3, label: "slap shake px" },
  // why: shake lasts the hitstop plus a couple of frames so it reads.
  shakeFrames: { min: 0, max: 20, step: 1, default: 6, label: "shake frames" },
  // why: GDD §15 — 2f zoom punch on slap.
  zoomPunchDeg: { min: 0, max: 5, step: 0.1, default: 1.2, label: "zoom punch °" },
  // why: handoff step 6 — ring decal lives 0.3 s.
  ringLife: { min: 0.05, max: 1, step: 0.01, default: 0.3, label: "slap ring life s" },
  // why: GDD §24 — big squash on slap.
  slapSquash: { min: 0, max: 0.6, step: 0.01, default: 0.28, label: "slap squash" }
});

export const look = tunables.define("sr.look", {
  // why: GDD §12 — border is outline/25 px (4 px at 100). Phase 0 has no outline loss; this previews it.
  outline: { min: 0, max: 100, step: 1, default: 100, label: "outline (preview)" },
  // why: GDD §23 — 1 px dark keyline outside the die-cut border.
  keylinePx: { min: 0, max: 4, step: 0.5, default: 1, label: "keyline px" },
  // why: GDD §13/§23 — Tack reads at ~48 px tall at the default camera (visual only; hurtbox stays 0.6 m). (DECISIONS)
  tackHeight: { min: 0.4, max: 5, step: 0.05, default: 2.8, label: "Tack sprite height m" },
  // why: mutes SFX when testing with headphones off; Shell master volume also applies.
  sfxVolume: { min: 0, max: 1, step: 0.05, default: 0.7, label: "SFX volume" }
});

export type MoveTuning = typeof move;
export type PeelTuning = typeof peel;
export type SlapTuning = typeof slap;
export type InputTuning = typeof input;
export type FallTuning = typeof fall;

/** Everything the sim reads. Passed in explicitly so tests can run with altered values. */
export interface SimTuning {
  move: MoveTuning;
  peel: PeelTuning;
  slap: SlapTuning;
  input: InputTuning;
  fall: FallTuning;
}

export const simTuning: SimTuning = { move, peel, slap, input, fall };
