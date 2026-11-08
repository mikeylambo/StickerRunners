import type { SurfaceKind } from "./Course";

/** One fixed 60 Hz tick of semantic input. Device-agnostic. */
export interface InputFrame {
  /** Lateral steer / slap aim, -1 (void side) … +1 (rail side). */
  steer: number;
  /** Peel button held. Release = slap. */
  peel: boolean;
  /** Kick-off pressed this tick (edge). */
  kick: boolean;
}

export const NO_INPUT: InputFrame = { steer: 0, peel: false, kick: false };

export type PlayerState =
  | "start"        // 0.3 s press-on at the line
  | "stuck"        // on a surface
  | "coyote"       // just ran off an edge; can still peel for N frames
  | "peeled"       // lifted, gliding, adhesion draining
  | "slapTravel"   // 3f snap toward the slap target
  | "falling"      // no adhesion / whiffed / coyote expired
  | "respawning"   // 1.0 s re-stick after a fall-out
  | "finished";

interface At { s: number; lat: number; h: number }

export type SimEvent =
  | ({ type: "peel" } & At)
  | ({ type: "slap"; entrySpeed: number; exitSpeed: number; n: 1 | -1; surface: SurfaceKind; distance: number } & At)
  | ({ type: "whiff" } & At)
  | ({ type: "land"; n: 1 | -1 } & At)
  | ({ type: "wrap" } & At)
  | ({ type: "kick"; speed: number } & At)
  | ({ type: "coyote" } & At)
  | ({ type: "fall"; reason: "adhesion" | "coyote" | "whiff" } & At)
  | ({ type: "fallout" } & At)
  | ({ type: "respawn" } & At)
  | ({ type: "restick" } & At)
  | ({ type: "hazard"; speedBefore: number; speedAfter: number } & At)
  | ({ type: "finish"; time: number } & At);

export type SimEventType = SimEvent["type"];
