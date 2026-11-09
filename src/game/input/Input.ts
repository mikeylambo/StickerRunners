/**
 * Device input → one semantic InputFrame per sim tick (keyboard and gamepad map to the same actions).
 *
 * Steer is lateral on the ribbon: -1 = toward the void (screen upper-left), +1 = toward the rail
 * (screen lower-right). Keyboard: A/W/←/↑ = void side, D/S/→/↓ = rail side. Gamepad left stick:
 * right or down = rail side (DECISIONS). Peel: Space / A (hold). Kick-off: Shift / X.
 * Touch (one thumb): see Touch.ts — hold = peel, release = slap, drag = steer/aim, flick up = kick-off.
 */
import type { InputFrame } from "../sim/types";
import { input as inputT } from "../../../config/tuning";
import { TouchGestures } from "./Touch";

const VOID_KEYS = new Set(["KeyA", "KeyW", "ArrowLeft", "ArrowUp"]);
const RAIL_KEYS = new Set(["KeyD", "KeyS", "ArrowRight", "ArrowDown"]);
const PEEL_KEYS = new Set(["Space"]);
const KICK_KEYS = new Set(["ShiftLeft", "ShiftRight"]);

export class Input {
  private readonly down = new Set<string>();
  private kickLatch = false;
  private padKickPrev = false;
  enabled = true;
  onAnyInput: (() => void) | null = null;
  readonly touch = new TouchGestures();
  /** True once a touch has been seen (switches the hint, shows the pause button). */
  touchSeen = false;

  attach(target: Window = window): () => void {
    const kd = (e: KeyboardEvent) => {
      this.onAnyInput?.();
      if (!this.enabled) return;
      if (PEEL_KEYS.has(e.code) || VOID_KEYS.has(e.code) || RAIL_KEYS.has(e.code)) e.preventDefault();
      if (KICK_KEYS.has(e.code) && !e.repeat) this.kickLatch = true;
      this.down.add(e.code);
    };
    const ku = (e: KeyboardEvent) => { this.down.delete(e.code); };
    const blur = () => this.down.clear();
    const pd = () => this.onAnyInput?.();
    target.addEventListener("keydown", kd);
    target.addEventListener("keyup", ku);
    target.addEventListener("blur", blur);
    target.addEventListener("pointerdown", pd);
    // iOS unlocks Web Audio most reliably on touchend
    target.addEventListener("touchend", pd, { passive: true });
    this.touch.onTouch = () => { this.touchSeen = true; this.onAnyInput?.(); };
    const detachTouch = this.touch.attach(target);
    return () => {
      detachTouch();
      target.removeEventListener("touchend", pd);
      target.removeEventListener("keydown", kd); target.removeEventListener("keyup", ku);
      target.removeEventListener("blur", blur); target.removeEventListener("pointerdown", pd);
    };
  }

  private pad(): Gamepad | null {
    let pads: ArrayLike<Gamepad | null>;
    try { pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : []; } catch { pads = []; }
    for (let i = 0; i < pads.length; i++) { const p = pads[i]; if (p && p.connected) return p; }
    return null;
  }

  /** Sample once per sim tick. Consumes the kick edge. */
  sample(): InputFrame {
    let steer = 0;
    for (const k of VOID_KEYS) if (this.down.has(k)) { steer -= 1; break; }
    for (const k of RAIL_KEYS) if (this.down.has(k)) { steer += 1; break; }
    let peel = [...PEEL_KEYS].some((k) => this.down.has(k));
    let kick = this.kickLatch;
    this.kickLatch = false;
    const gp = this.pad();
    if (gp) {
      const x = gp.axes[0] ?? 0; const y = gp.axes[1] ?? 0;
      const mag = Math.hypot(x, y);
      if (mag > inputT.deadzone) {
        const k = (mag - inputT.deadzone) / (1 - inputT.deadzone) / mag;
        steer += Math.max(-1, Math.min(1, (x + y) * k));
      }
      if (gp.buttons[14]?.pressed || gp.buttons[12]?.pressed) steer -= 1;
      if (gp.buttons[15]?.pressed || gp.buttons[13]?.pressed) steer += 1;
      if (gp.buttons[0]?.pressed) peel = true;
      const kp = !!gp.buttons[2]?.pressed;
      if (kp && !this.padKickPrev) kick = true;
      this.padKickPrev = kp;
    }
    const t = this.touch.sample();
    if (t.active) { steer += t.steer; peel = peel || t.peel; kick = kick || t.kick; }
    if (!this.enabled) return { steer: 0, peel: false, kick: false };
    return { steer: Math.max(-1, Math.min(1, steer)), peel, kick };
  }
}
