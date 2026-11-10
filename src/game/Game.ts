/**
 * Game = fixed 60 Hz sim loop + Three.js presentation + event-driven VFX/audio.
 * The Shell owns flow (title/menu/pause/results); this class only runs a duel-less Phase 0 ribbon.
 */
import * as THREE from "three";
import { Course } from "./sim/Course";
import { Sim, DT } from "./sim/Sim";
import { Autopilot } from "./sim/Autopilot";
import type { InputFrame, SimEvent } from "./sim/types";
import { NO_INPUT } from "./sim/types";
import { Input } from "./input/Input";
import { Sfx } from "./audio/Sfx";
import { CourseView } from "./render/CourseView";
import { TackView, type TackPose } from "./render/TackView";
import { SlapRings } from "./render/SurfaceDecals";
import { DiagonalCamera } from "./render/DiagonalCamera";
import { Backdrop } from "./render/Backdrop";
import { DebugView } from "./render/DebugView";
import type { Flags } from "./flags";
import { phase0Stage } from "../../data/stages/phase0";
import { webStage } from "../../data/stages/web";
import { WebBot } from "./sim/WebBot";
import { simTuning, move, feel, look, camera as camT } from "../../config/tuning";
import { createRenderer } from "./render/createRenderer";
import { PerfGovernor } from "./render/PerfGovernor";
import { report } from "./dev/report";

export interface GameHooks {
  onFinish?: (summary: RunSummary) => void;
  shakeScale?: () => number;
  masterVolume?: () => number;
}

export interface RunSummary { time: number; slaps: number; whiffs: number; falls: number; peels: number; kicks: number; minSlapKeep: number }

const MAX_STEPS_PER_FRAME = 8;
const EVENT_LOG = 200;

export class Game {
  course!: Course;
  sim!: Sim;
  bot!: { decide(): InputFrame };
  readonly input = new Input();
  readonly sfx = new Sfx();
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  cam!: DiagonalCamera;
  private courseView!: CourseView;
  private tack!: TackView;
  private rings!: SlapRings;
  private debug: DebugView | null = null;
  private world = new THREE.Group();

  running = false;
  paused = false;
  autopilot: boolean;
  readonly eventLog: Array<SimEvent & { tick: number }> = [];
  private acc = 0;
  private last = 0;
  private prev: TackPose = { s: 0, lat: 0, h: 0 };
  private finishAt = -1;
  private hint: HTMLElement | null;
  private hintTimer = 0;
  private pauseBtn: HTMLElement | null;
  frames = 0;
  /** Which context attributes the renderer ended up with (diagnostics). */
  readonly rendererAttempt: string;
  readonly perf: PerfGovernor;
  /** Resolved orientation this frame. */
  portrait = false;
  private loopErrors = 0;
  private lastSize = "";

  constructor(private readonly canvas: HTMLCanvasElement, readonly flags: Flags, private readonly hooks: GameHooks = {}) {
    this.autopilot = flags.bot;
    // High-dpr phones don't need MSAA (pixels are already tiny) and it's the first thing to cost frame time.
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    const choice = createRenderer(canvas, { antialias: !(coarse && devicePixelRatio >= 2), preserveDrawingBuffer: flags.step });
    this.renderer = choice.renderer;
    this.rendererAttempt = choice.attempt;
    this.perf = new PerfGovernor(devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.perf.ratio);
    this.scene.add(new THREE.HemisphereLight("#c4cbff", "#2b1f3d", 1.6));
    const sun = new THREE.DirectionalLight("#fff1dc", 1.5);
    sun.position.set(0.4, 1, 0.6);
    this.scene.add(sun, this.world);
    this.build();
    this.input.attach();
    this.input.onAnyInput = () => this.sfx.unlock();
    this.input.touch.accepting = () => this.running && !this.paused && !this.autopilot;
    this.hint = document.getElementById("sr-hint");
    this.pauseBtn = document.getElementById("sr-pause");
    // The game is the single owner of the canvas size. Observe the element itself so hidden→shown,
    // orientation flips, dynamic toolbars and 0×0 starts all resize before the next frame.
    addEventListener("resize", () => this.resize());
    if (typeof ResizeObserver === "function") new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    if (!flags.step) {
      // Schedule the next frame first, so one thrown frame can never kill the loop (a frozen/blank canvas).
      const loop = (now: number) => {
        requestAnimationFrame(loop);
        try { this.frame(now); }
        catch (e) {
          if (this.loopErrors++ < 3) report("Frame error", e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e));
        }
      };
      requestAnimationFrame(loop);
    }
  }

  private build(): void {
    this.world.clear();
    this.course = new Course(this.flags.stage === "web" ? webStage : phase0Stage, move.ribbonWidth);
    this.sim = new Sim(this.course, simTuning, { god: this.flags.god });
    this.bot = this.flags.stage === "web" ? new WebBot(this.sim, this.flags.line) : new Autopilot(this.sim);
    this.courseView = new CourseView(this.course);
    this.tack = new TackView(this.course);
    this.rings = new SlapRings(this.course.track);
    this.cam = new DiagonalCamera(this.course.track);
    this.cam.heightFollow = this.course.stage.cameraHeightFollow ?? 0;
    const mid = this.course.track.frameAt(this.course.track.length / 2).pos;
    const backdrop = new Backdrop(new THREE.Vector3(mid.x, mid.y, mid.z), 3200);
    this.world.add(backdrop.group, this.courseView.group, this.rings.group, this.tack.group);
    this.backdrop = backdrop;
    if (this.flags.tells) { this.debug = new DebugView(this.course); this.world.add(this.debug.group); }
    this.resize();
  }
  private backdrop!: Backdrop;

  /** Fresh run (Shell level:loaded / restart). Rebuilds the course if ribbon width was retuned. */
  start(): void {
    if (Math.abs(this.course.halfWidth * 2 - move.ribbonWidth) > 1e-9) this.build();
    this.sim.reset();
    if (this.flags.stage === "web") this.bot = new WebBot(this.sim, this.flags.line); // fresh route state
    this.cam.reset();
    this.rings.clear();
    this.eventLog.length = 0;
    this.prev = { s: this.sim.p.s, lat: this.sim.p.lat, h: this.sim.p.h };
    this.acc = 0; this.finishAt = -1;
    this.running = true; this.paused = false;
    this.input.touch.reset();
    this.hintTimer = 7;
    this.updateHint();
    if (this.hint) this.hint.style.opacity = "1";
    this.resize();
  }

  stop(): void { this.running = false; this.input.touch.reset(); if (this.hint) this.hint.style.opacity = "0"; }
  setPaused(p: boolean): void { this.paused = p; this.last = performance.now(); if (p) this.input.touch.reset(); }

  /** Touch devices get the touch hint; switches the first time a touch is seen. */
  private updateHint(): void {
    if (!this.hint) return;
    const touchUi = this.isTouchUi();
    const want = touchUi ? "touch" : "keys";
    if (this.hint.dataset.mode === want) return;
    this.hint.dataset.mode = want;
    this.hint.innerHTML = touchUi
      ? "<b>HOLD</b> PEEL · <b>LET GO</b> SLAP<br><b>DRAG</b> STEER · <b>FLICK UP</b> KICK-OFF"
      : "<b>HOLD SPACE</b> PEEL · <b>RELEASE</b> SLAP · <b>SHIFT</b> KICK-OFF · <b>A/D</b> STEER";
  }

  private isTouchUi(): boolean {
    return this.input.touchSeen || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);
  }

  private resolvePortrait(): boolean {
    const o = camT.orient; // ?orient= seeds this tunable at boot; the panel can flip it live
    if (o === "portrait") return true;
    if (o === "landscape") return false;
    return innerHeight > innerWidth;
  }

  resize(): void {
    // CSS sizes the canvas (100% of #game); we only size the drawing buffer to match it.
    const w = Math.round(this.canvas.clientWidth || innerWidth);
    const h = Math.round(this.canvas.clientHeight || innerHeight);
    if (w <= 0 || h <= 0) return;
    const key = `${w}x${h}@${this.perf.ratio}`;
    if (key !== this.lastSize) {
      this.lastSize = key;
      this.renderer.setPixelRatio(this.perf.ratio);
      this.renderer.setSize(w, h, false);
    }
    if (this.cam) { this.cam.camera.aspect = w / h; this.cam.viewportHeightPx = h; this.cam.camera.updateProjectionMatrix(); }
  }

  /** Advance exactly one sim tick (also used by step mode). */
  tickOnce(override?: InputFrame): SimEvent[] {
    const p = this.sim.p;
    this.prev = { s: p.s, lat: p.lat, h: p.h };
    const live = this.input.sample();
    const frame = override ?? (this.autopilot ? this.bot.decide() : this.running ? live : NO_INPUT);
    const ev = this.sim.step(frame);
    for (const e of ev) this.handle(e);
    if (this.finishAt >= 0 && this.sim.time >= this.finishAt) {
      this.finishAt = -1;
      this.stop();
      const st = this.sim.stats;
      this.hooks.onFinish?.({ time: this.sim.finishTime, slaps: st.slaps, whiffs: st.whiffs, falls: st.falls, peels: st.peels, kicks: st.kicks, minSlapKeep: st.minSlapKeep });
    }
    return ev;
  }

  private handle(e: SimEvent): void {
    this.eventLog.push({ ...e, tick: this.sim.tick });
    if (this.eventLog.length > EVENT_LOG) this.eventLog.shift();
    this.sfx.volume = look.sfxVolume * (this.hooks.masterVolume?.() ?? 1);
    const shake = this.hooks.shakeScale?.() ?? 1;
    switch (e.type) {
      case "peel": this.sfx.play("peel"); break;
      case "slap":
        this.sfx.play("slap", Math.min(1.2, 0.7 + e.entrySpeed / 60));
        this.cam.shake(feel.slapShakePx, feel.shakeFrames);
        this.cam.zoomPunch();
        this.rings.spawn(e.s, e.lat, e.h, e.n, feel.ringLife, 1, e.axis);
        this.tack.slapped();
        break;
      case "whiff": this.sfx.play("whiff"); break;
      case "kick": this.sfx.play("kick"); break;
      case "land": this.sfx.play("land"); this.rings.spawn(e.s, e.lat, e.h, e.n, feel.ringLife * 0.6, 0.5); break;
      case "wrap": this.sfx.play("wrap"); this.rings.spawn(e.s, e.lat, e.h, 1, feel.ringLife * 0.6, 0.6); break;
      case "hazard": this.sfx.play("hazard"); this.cam.shake(feel.slapShakePx * 1.5 * shake, feel.shakeFrames); break;
      case "fallout": this.sfx.play("fallout"); break;
      case "respawn": this.cam.reset(); break;
      case "restick": this.sfx.play("restick"); this.rings.spawn(e.s, e.lat, e.h, 1, feel.ringLife, 0.8); break;
      case "finish": this.finishAt = this.sim.time + 1.0; break;
      default: break;
    }
  }

  /** rAF driver: fixed-step accumulator, ?slow scales sim time, render interpolates. */
  frame(now: number): void {
    const intervalMs = this.last ? now - this.last : 0;
    const realDt = Math.max(0, Math.min(0.1, intervalMs / 1000)); // clamp: hitches and backwards clocks
    this.last = now;
    const r = this.perf.sample(intervalMs);
    if (r !== null) this.resize();
    if (this.running && !this.paused) {
      this.acc += realDt * this.flags.slow;
      let n = 0;
      while (this.acc >= DT && n < MAX_STEPS_PER_FRAME) { this.tickOnce(); this.acc -= DT; n++; }
      if (n === MAX_STEPS_PER_FRAME) this.acc = 0;
    } else if (!this.running) {
      // menus: keep Tack idling at the line behind the Shell UI
      this.acc = 0;
    }
    this.render(this.paused ? 0 : realDt * this.flags.slow, this.running && !this.paused ? this.acc / DT : 1);
  }

  render(dt: number, alpha = 1): void {
    const p = this.sim.p;
    if (this.canvas.width === 0 || this.canvas.height === 0) this.resize();
    this.portrait = this.resolvePortrait();
    this.cam.portrait = this.portrait;
    this.updateHint();
    if (this.pauseBtn) this.pauseBtn.hidden = !(this.running && !this.paused && this.isTouchUi());
    const jump = Math.abs(p.s - this.prev.s) > 20;
    const a = jump || this.sim.p.hitstop > 0 ? 1 : alpha;
    const pose: TackPose = {
      s: this.prev.s + (p.s - this.prev.s) * a,
      lat: this.prev.lat + (p.lat - this.prev.lat) * a,
      h: this.prev.h + (p.h - this.prev.h) * a
    };
    this.cam.update(Math.max(dt, 1e-4), pose.s, pose.lat, p.speed, this.hooks.shakeScale?.() ?? 1, pose.h);
    this.courseView.update(this.course, this.sim.time);
    this.backdrop.follow(this.cam.camera);
    this.tack.update(dt, pose, p, this.cam.camera, this.cam.worldPerPx);
    this.rings.update(dt);
    this.debug?.update(this.sim);
    if (this.hint && this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint.style.opacity = "0";
    }
    this.renderer.render(this.scene, this.cam.camera);
    this.frames++;
  }
}
