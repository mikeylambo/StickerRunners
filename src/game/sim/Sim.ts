/**
 * Track-space player sim. Fixed 60 Hz, deterministic, renderer-free.
 * Player position = (s, lateral, height) on the Course's spline. Emits semantic events per tick.
 *
 * Pillar 1 — Stick or Fall: the only states are stuck-ish (stuck/coyote/slapTravel) and
 * peeled/falling. There is no jump: peel lifts to a fixed hover, it never adds height above that.
 */
import type { Course, Surface } from "./Course";
import type { SimTuning } from "../../../config/tuning";
import { findSlapTarget } from "./Targeting";
import type { InputFrame, PlayerState, SimEvent } from "./types";

export const SIM_HZ = 60;
export const DT = 1 / SIM_HZ;
const START_TIME = 0.3; // GDD §9 — 0.3 s press-on at the line
const WRAP_GRACE_FRAMES = 8; // steer ignored after folding round an edge (DECISIONS)

export interface Player {
  state: PlayerState;
  s: number; lat: number; h: number;
  speed: number; latVel: number; vh: number;
  adhesion: number;
  surfaceId: number;
  /** Normal of the surface we are on / last left. */
  n: 1 | -1;
  hoverBase: number;
  coyote: number;
  canSlap: boolean;
  travel: null | { s0: number; l0: number; h0: number; s1: number; l1: number; h1: number; frame: number; total: number; surfaceId: number; entrySpeed: number };
  hitstop: number;
  kickCd: number;
  invuln: number;
  offscreen: number;
  timer: number;
  fallStartS: number;
  wrapGrace: number;
  peelHeldPrev: boolean;
  peelBuf: number;
  kickBuf: number;
  /** Last steer value, for slap aim and the view. */
  steer: number;
}

export interface SimStats {
  slaps: number; whiffs: number; peels: number; falls: number; kicks: number; hazards: number; wraps: number;
  minSlapKeep: number;
}

export interface SimOptions { god?: boolean }

export class Sim {
  p!: Player;
  tick = 0;
  time = 0;
  finished = false;
  finishTime = 0;
  stats!: SimStats;
  events: SimEvent[] = [];

  constructor(readonly course: Course, readonly t: SimTuning, readonly opts: SimOptions = {}) {
    this.reset();
  }

  reset(): void {
    const road = this.course.roadAt(this.course.startS)!;
    this.p = {
      state: "start", s: this.course.startS, lat: 0, h: road.h, speed: 0, latVel: 0, vh: 0,
      adhesion: this.t.peel.adhesionMax, surfaceId: road.id, n: 1, hoverBase: 0, coyote: 0, canSlap: false,
      travel: null, hitstop: 0, kickCd: 0, invuln: 0, offscreen: 0, timer: START_TIME, fallStartS: 0,
      wrapGrace: 0, peelHeldPrev: false, peelBuf: 0, kickBuf: 0, steer: 0
    };
    this.tick = 0; this.time = 0; this.finished = false; this.finishTime = 0;
    this.stats = { slaps: 0, whiffs: 0, peels: 0, falls: 0, kicks: 0, hazards: 0, wraps: 0, minSlapKeep: Infinity };
    this.events = [];
  }

  private emit(e: SimEvent): void { this.events.push(e); }
  private at() { return { s: this.p.s, lat: this.p.lat, h: this.p.h }; }
  private get halfW() { return this.t.move.tackHalfWidth; }
  private get belowSheet() { return -(this.course.stage.roadThickness + 0.05); }

  /** Advance one fixed tick. Returns the events emitted this tick. */
  step(input: InputFrame): SimEvent[] {
    this.events = [];
    const p = this.p;
    this.tick++;
    const pressed = input.peel && !p.peelHeldPrev;
    p.peelHeldPrev = input.peel;
    p.steer = Math.max(-1, Math.min(1, input.steer));
    const buf = this.t.input.bufferFrames;
    if (pressed) p.peelBuf = buf;
    if (input.kick) p.kickBuf = buf;

    // Hitstop freezes the sim (and the buffers, so presses during hitstop are kept).
    if (p.hitstop > 0) { p.hitstop--; return this.events; }

    this.time += DT;
    p.kickCd = Math.max(0, p.kickCd - DT);
    p.invuln = Math.max(0, p.invuln - DT);

    switch (p.state) {
      case "start": this.updateStart(); break;
      case "stuck": this.updateStuck(input); break;
      case "coyote": this.updateCoyote(input); break;
      case "peeled": this.updatePeeled(input); break;
      case "slapTravel": this.updateTravel(); break;
      case "falling": this.updateFalling(input); break;
      case "respawning": this.updateRespawning(); break;
      case "finished": this.updateFinished(); break;
    }

    if (!this.finished && p.s >= this.course.finishS && p.state !== "respawning") {
      this.finished = true;
      this.finishTime = this.time;
      this.emit({ type: "finish", time: this.time, ...this.at() });
      if (p.state === "stuck") p.state = "finished";
    }

    p.peelBuf = Math.max(0, p.peelBuf - 1);
    p.kickBuf = Math.max(0, p.kickBuf - 1);
    return this.events;
  }

  // ───────────────────────────────────────────── states

  private updateStart(): void {
    const p = this.p;
    p.timer -= DT;
    if (p.timer <= 0) p.state = "stuck";
  }

  private steer(input: InputFrame, control: number): void {
    const p = this.p; const m = this.t.move;
    const s = p.wrapGrace > 0 ? 0 : p.steer;
    if (p.wrapGrace > 0) p.wrapGrace--;
    const target = s * m.lateralSpeed * control;
    const rate = (m.lateralSpeed / Math.max(m.lateralRampTime, 1e-3)) * DT;
    p.latVel += Math.max(-rate, Math.min(rate, target - p.latVel));
    p.lat += p.latVel * DT;
    void input;
  }

  private accelerate(): void {
    const p = this.p; const m = this.t.move;
    if (p.speed < m.topSpeed) p.speed = Math.min(m.topSpeed, p.speed + (m.topSpeed / Math.max(m.accelTime, 0.01)) * DT);
    else p.speed = Math.max(m.topSpeed, p.speed - m.overspeedBleed * DT);
  }

  private contains(x: Surface, s: number, lat: number): boolean {
    return s >= x.s0 && s < x.s1 && lat >= x.l0 && lat <= x.l1;
  }

  private clampRail(x: Surface): void {
    const p = this.p;
    if (x.railRight && p.lat > x.l1 - this.halfW) { p.lat = x.l1 - this.halfW; p.latVel = Math.min(p.latVel, 0); }
  }

  private updateStuck(input: InputFrame): void {
    const p = this.p; const m = this.t.move;
    this.accelerate();
    if (p.kickBuf > 0 && p.kickCd <= 0) {
      p.speed = Math.max(p.speed, Math.min(m.kickoffCap, p.speed + m.kickoffImpulse));
      p.kickCd = m.kickoffCooldown; p.kickBuf = 0;
      this.stats.kicks++;
      this.emit({ type: "kick", speed: p.speed, ...this.at() });
    }
    p.speed = Math.min(p.speed, m.absCap);
    this.steer(input, 1);
    p.s += p.speed * DT;

    let x = this.course.surface(p.surfaceId)!;
    this.clampRail(x);
    if (!this.contains(x, p.s, p.lat)) {
      const other = this.course.supportAt(p.s, p.lat, p.h, p.n);
      if (other) { p.surfaceId = other.id; x = other; }
      else if (this.opts.god && (x.kind === "road")) {
        // ?god: gaps and the void edge are solid
        p.lat = Math.max(p.lat, x.l0 + 0.01);
        const next = this.course.roadAt(p.s);
        if (next) { p.surfaceId = next.id; x = next; }
      } else if (x.wrapToTop && p.lat < x.l0 && p.s >= x.s0 && p.s < x.s1) {
        const top = this.course.supportAt(p.s, x.l0 + 0.05, 0, 1, 0.5);
        if (top) {
          p.surfaceId = top.id; p.n = 1; p.h = top.h; p.lat = top.l0 + this.halfW + 0.2;
          p.latVel = Math.abs(p.latVel) * 0.5; p.wrapGrace = WRAP_GRACE_FRAMES;
          this.stats.wraps++;
          this.emit({ type: "wrap", ...this.at() });
          x = top;
        }
      } else {
        p.state = "coyote"; p.coyote = this.t.input.coyoteFrames;
        this.emit({ type: "coyote", ...this.at() });
        if (this.tryPeel(input)) return;
        if (p.coyote <= 0) this.beginFall("coyote");
        return;
      }
    }
    if (x.kind === "road" && x.n === 1 && p.invuln <= 0) {
      const z = this.course.hazardAt(p.s, p.lat, this.halfW);
      if (z) {
        const before = p.speed;
        p.speed *= m.hazardSpeedKeep; p.invuln = m.hazardInvuln;
        this.stats.hazards++;
        this.emit({ type: "hazard", speedBefore: before, speedAfter: p.speed, ...this.at() });
      }
    }
    this.tryPeel(input);
  }

  private updateCoyote(input: InputFrame): void {
    const p = this.p;
    this.steer(input, 1);
    p.s += p.speed * DT;
    const back = this.course.supportAt(p.s, p.lat, p.h, p.n);
    if (back) { p.state = "stuck"; p.surfaceId = back.id; return; }
    p.coyote--;
    if (this.tryPeel(input)) return;
    if (p.coyote <= 0) this.beginFall("coyote");
  }

  private tryPeel(input: InputFrame): boolean {
    const p = this.p;
    if (!(p.peelBuf > 0 && input.peel)) return false;
    if (p.state !== "stuck" && p.state !== "coyote") return false;
    p.state = "peeled"; p.peelBuf = 0; p.hoverBase = p.h; p.vh = 0;
    this.stats.peels++;
    this.emit({ type: "peel", ...this.at() });
    return true;
  }

  private updatePeeled(input: InputFrame): void {
    const p = this.p; const pt = this.t.peel;
    if (!this.opts.god) p.adhesion = Math.max(0, p.adhesion - pt.adhesionDrain * DT);
    p.speed *= 1 - pt.forwardDecay * DT;
    this.steer(input, pt.lateralControl);
    p.s += p.speed * DT;
    const target = p.hoverBase + p.n * pt.peelHeight;
    p.h += (target - p.h) * (1 - Math.exp(-DT / Math.max(pt.liftTime, 1e-3)));
    if (!input.peel) { this.attemptSlap(); return; }
    if (p.adhesion <= 0) { p.canSlap = true; this.beginFall("adhesion"); }
  }

  private beginFall(reason: "adhesion" | "coyote" | "whiff"): void {
    const p = this.p;
    if (reason !== "adhesion") p.canSlap = false;
    p.state = "falling"; p.vh = Math.min(p.vh, 0); p.offscreen = 0; p.fallStartS = p.s;
    this.emit({ type: "fall", reason, ...this.at() });
  }

  private updateFalling(input: InputFrame): void {
    const p = this.p; const f = this.t.fall;
    const prevH = p.h;
    p.vh -= this.t.peel.gravity * DT;
    p.h += p.vh * DT;
    this.steer(input, this.t.peel.lateralControl);
    p.s += p.speed * DT;
    // land on any top face we pass through (keeps speed — momentum is sacred)
    for (const x of this.course.surfaces) {
      if (x.n !== 1 || !this.contains(x, p.s, p.lat)) continue;
      const crossed = prevH >= x.h && p.h <= x.h;
      const inSlabUpper = p.h < x.h && p.h >= x.h - x.thickness * 0.5;
      if (crossed || inSlabUpper) { this.stickTo(x); this.emit({ type: "land", n: 1, ...this.at() }); return; }
      // lower half of a slab: scrape beneath it instead of passing through
      if (p.h < x.h && p.h > x.h - x.thickness) { p.h = x.h - x.thickness - 0.01; p.vh = Math.min(p.vh, 0); }
    }
    if (p.canSlap && !input.peel) { this.attemptSlap(); return; }
    if (p.h < -f.falloutDepth || Math.abs(p.lat) > 40) {
      p.offscreen += DT;
      if (p.offscreen >= f.falloutTime) this.beginRespawn();
    }
  }

  private stickTo(x: Surface): void {
    const p = this.p;
    p.state = "stuck"; p.surfaceId = x.id; p.n = x.n; p.h = x.h; p.vh = 0;
    p.adhesion = this.t.peel.adhesionMax; p.canSlap = false;
  }

  private attemptSlap(): void {
    const p = this.p; const sl = this.t.slap;
    const travelS = p.speed * sl.snapFrames * DT;
    const target = findSlapTarget(this.course, p, p.steer, travelS, sl, this.belowSheet);
    if (!target) {
      this.stats.whiffs++;
      this.emit({ type: "whiff", ...this.at() });
      this.beginFall("whiff");
      return;
    }
    const x = target.surface;
    const lMin = x.l0 + 0.05;
    const lMax = x.railRight ? x.l1 - this.halfW : x.l1 - 0.05;
    const s1 = Math.min(Math.max(target.s + (target.via === "beneath" ? 0 : travelS), x.s0), x.s1 - 0.01);
    p.travel = {
      s0: p.s, l0: p.lat, h0: p.h,
      s1, l1: Math.min(Math.max(target.lat, lMin), lMax), h1: x.h,
      frame: 0, total: Math.max(1, Math.round(sl.snapFrames)), surfaceId: x.id, entrySpeed: p.speed
    };
    p.state = "slapTravel"; p.canSlap = false;
    this.updateTravel(); // the release tick is snap frame 1
  }

  private updateTravel(): void {
    const p = this.p; const tr = p.travel!;
    tr.frame++;
    const k = tr.frame / tr.total;
    p.s = tr.s0 + (tr.s1 - tr.s0) * k;
    p.lat = tr.l0 + (tr.l1 - tr.l0) * k;
    p.h = tr.h0 + (tr.h1 - tr.h0) * k;
    if (tr.frame < tr.total) return;
    const x = this.course.surface(tr.surfaceId)!;
    this.stickTo(x);
    const keep = this.t.slap.slapMomentumKeep;
    p.speed = Math.min(this.t.move.absCap, tr.entrySpeed * keep);
    p.hitstop = Math.round(this.t.slap.hitstopFrames);
    p.latVel *= 0.5;
    const distance = Math.hypot(tr.s1 - tr.s0, tr.l1 - tr.l0, tr.h1 - tr.h0);
    p.travel = null;
    this.stats.slaps++;
    if (tr.entrySpeed > 0) this.stats.minSlapKeep = Math.min(this.stats.minSlapKeep, p.speed / tr.entrySpeed);
    this.emit({ type: "slap", entrySpeed: tr.entrySpeed, exitSpeed: p.speed, n: x.n, surface: x.kind, distance, ...this.at() });
  }

  private beginRespawn(): void {
    const p = this.p; const f = this.t.fall; const c = this.course;
    this.stats.falls++;
    this.emit({ type: "fallout", ...this.at() });
    let s = Math.max(c.startS, p.fallStartS - f.respawnBack);
    while (s > c.startS && (c.inGap(s) || c.inGap(s + 12) || c.hazardAt(s, 0, 3) || c.hazardAt(s + 6, 0, 3))) s -= 1;
    const road = c.roadAt(s)!;
    Object.assign(p, {
      state: "respawning", s, lat: 0, h: road.h, n: 1, surfaceId: road.id, speed: 0, latVel: 0, vh: 0,
      adhesion: this.t.peel.adhesionMax, timer: f.restickTime, offscreen: 0, canSlap: false, travel: null
    } satisfies Partial<Player>);
    this.emit({ type: "respawn", ...this.at() });
  }

  private updateRespawning(): void {
    const p = this.p;
    p.timer -= DT;
    if (p.timer <= 0) {
      p.state = "stuck"; p.speed = this.t.fall.respawnSpeed;
      this.emit({ type: "restick", ...this.at() });
    }
  }

  private updateFinished(): void {
    const p = this.p;
    p.s += p.speed * DT;
    p.lat += (0 - p.lat) * 0.05;
  }

  // ───────────────────────────────────────────── queries for view / tests

  /** True if the stuck invariant holds: a stuck player is inside its surface rect at its height. */
  stuckInvariantOk(): boolean {
    const p = this.p;
    if (p.state !== "stuck" && p.state !== "finished") return true;
    if (this.opts.god) return true;
    const x = this.course.surface(p.surfaceId);
    if (!x) return false;
    return p.s >= x.s0 - 1e-6 && p.s < x.s1 + 1e-6 && p.lat >= x.l0 - 1e-6 && p.lat <= x.l1 + 1e-6 && Math.abs(p.h - x.h) < 1e-6;
  }
}
