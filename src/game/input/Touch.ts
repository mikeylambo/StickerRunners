/**
 * One-thumb touch gestures → the same semantic actions keyboard/gamepad produce (steer, peel, kick).
 *
 * Each touch is classified in a short gesture window (touch.gestureWindowMs, ~4 sim frames):
 *  - quick upward flick (≥ kickMinPx up, mostly vertical, within kickMaxMs)  → Kick-off, never a peel
 *  - horizontal drag ≥ steerStartPx inside the window                          → steer-only touch (stay stuck)
 *  - otherwise, once the window ends                                           → Peel (hold); release = Slap
 * While held, horizontal drag relative to the touch-down point steers / aims the slap cone.
 * A tap released inside the window is a peel-tap (peel one tick, then slap), like tapping Space.
 * A second finger is ignored (reserved for Patch, Phase 1).
 *
 * Classification runs on sim ticks (sample()), not wall-clock, so it is deterministic in step mode.
 */
import { touch as T } from "../../../config/tuning";

type Phase = "idle" | "pending" | "peel" | "steer" | "kicked" | "tap";

export interface TouchSample { steer: number; peel: boolean; kick: boolean; active: boolean }

export class TouchGestures {
  private id: number | null = null;
  private x0 = 0; private y0 = 0; private t0 = 0;
  private x = 0; private y = 0;
  private phase: Phase = "idle";
  private ticks = 0;
  private kickLatch = false;
  /** Gameplay accepts touches only while this returns true (running, not paused). */
  accepting: () => boolean = () => true;
  onTouch: (() => void) | null = null;

  attach(target: Window = window): () => void {
    const down = (e: PointerEvent) => this.down(e);
    const move = (e: PointerEvent) => this.move(e);
    const up = (e: PointerEvent) => this.up(e, false);
    const cancel = (e: PointerEvent) => this.up(e, true);
    target.addEventListener("pointerdown", down, { passive: false });
    target.addEventListener("pointermove", move, { passive: false });
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", cancel);
    return () => {
      target.removeEventListener("pointerdown", down); target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up); target.removeEventListener("pointercancel", cancel);
    };
  }

  private static isUi(t: EventTarget | null): boolean {
    return t instanceof Element && !!t.closest("button, a, input, select, [data-choice-id], #sr-pause, .slu-panel, .slu-tune, [data-sr-ui]");
  }

  private down(e: PointerEvent): void {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    this.onTouch?.();
    if (TouchGestures.isUi(e.target) || !this.accepting()) return;
    if (this.id !== null) return; // second finger: reserved for Patch (Phase 1)
    e.preventDefault();
    this.id = e.pointerId;
    this.x0 = this.x = e.clientX; this.y0 = this.y = e.clientY; this.t0 = e.timeStamp;
    this.ticks = 0;
    this.phase = "pending";
  }

  private move(e: PointerEvent): void {
    if (e.pointerId !== this.id) return;
    e.preventDefault();
    this.x = e.clientX; this.y = e.clientY;
    if (this.phase !== "pending") return;
    if (this.isKick(e.timeStamp)) { this.phase = "kicked"; this.kickLatch = true; return; }
    if (Math.abs(this.x - this.x0) >= T.steerStartPx && Math.abs(this.x - this.x0) > Math.abs(this.y - this.y0)) this.phase = "steer";
  }

  private up(e: PointerEvent, cancelled: boolean): void {
    if (e.pointerId !== this.id) return;
    this.x = e.clientX; this.y = e.clientY;
    if (this.phase === "pending") {
      if (!cancelled && this.isKick(e.timeStamp)) this.kickLatch = true;
      else if (!cancelled) { this.phase = "tap"; this.id = null; return; }
    }
    this.phase = "idle";
    this.id = null;
  }

  private isKick(now: number): boolean {
    const up = this.y0 - this.y;
    return up >= T.kickMinPx && up > Math.abs(this.x - this.x0) * 1.5 && now - this.t0 <= T.kickMaxMs;
  }

  /** Drop any held touch (pause, run end) so nothing stays peeled across screens. */
  reset(): void { this.phase = "idle"; this.id = null; this.kickLatch = false; }

  /** Call once per sim tick. */
  sample(): TouchSample {
    if (this.phase === "pending") {
      this.ticks++;
      if (this.ticks >= Math.round(T.gestureWindowMs / (1000 / 60))) this.phase = "peel";
    }
    const kick = this.kickLatch;
    this.kickLatch = false;
    const dx = this.x - this.x0;
    const steering = this.phase === "peel" || this.phase === "steer";
    const mag = Math.max(0, Math.abs(dx) - T.steerDeadPx);
    const steer = steering ? Math.sign(dx) * Math.min(1, mag / Math.max(1, T.steerFullPx - T.steerDeadPx)) : 0;
    const peel = this.phase === "peel" || this.phase === "tap";
    const active = this.phase !== "idle" || kick;
    if (this.phase === "tap") this.phase = "idle"; // peel for exactly one tick, then release → slap
    return { steer, peel, kick, active };
  }
}
