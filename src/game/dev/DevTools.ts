/**
 * Dev hooks: the live tuning panel (backtick) over config/tuning.ts, and window.__GAME.
 * __GAME.step(n) advances n sim ticks synchronously and renders once (use with ?step for headless).
 * __GAME.run(ticks) does the same in setTimeout chunks and resolves when done or finished.
 */
import { tunables, loadTuningCanon } from "@slu/web-shell/tuning";
import { mountTuningPanel } from "@slu/web-shell/tuning/panel";
import type { Game } from "../Game";
import type { InputFrame } from "../sim/types";

export interface GameHook {
  game: Game;
  readonly state: Record<string, unknown>;
  /** Advance n ticks. Optional input overrides the live devices (for scripted headless runs). */
  step(n?: number, input?: Partial<InputFrame>): Record<string, unknown>;
  /** Teleport Tack onto the surface containing (s, lat) at height h (debug / screenshots). */
  place(s: number, lat: number, h?: number, n?: 1 | -1): void;
  run(ticks: number, chunk?: number): Promise<Record<string, unknown>>;
  setAutopilot(on: boolean): void;
  tunables: typeof tunables;
  events(): unknown[];
}

declare global { interface Window { __GAME?: GameHook } }

export function installDevTools(game: Game): void {
  // Saved presets (tuning/<group>.json) override schema defaults; normally there are none.
  loadTuningCanon(import.meta.glob("/tuning/*.json", { eager: true }));
  mountTuningPanel({ startOpen: false });

  const snapshot = (): Record<string, unknown> => {
    const p = game.sim.p;
    return {
      tick: game.sim.tick, time: +game.sim.time.toFixed(3), state: p.state, s: +p.s.toFixed(2), lat: +p.lat.toFixed(3), h: +p.h.toFixed(3),
      speed: +p.speed.toFixed(3), adhesion: +p.adhesion.toFixed(3), n: p.n, finished: game.sim.finished, running: game.running,
      progress: +(p.s / game.course.finishS).toFixed(4), stats: { ...game.sim.stats }, autopilot: game.autopilot, frames: game.frames
    };
  };
  const step = (n = 1, input?: Partial<InputFrame>) => {
    for (let i = 0; i < n && game.running; i++) game.tickOnce(input ? { steer: 0, peel: false, kick: false, ...input } : undefined);
    game.render(1 / 60);
    return snapshot();
  };
  window.__GAME = {
    game,
    get state() { return snapshot(); },
    step,
    run: (ticks, chunk = 120) => new Promise((resolve) => {
      let left = ticks;
      const go = () => {
        step(Math.min(chunk, left));
        left -= chunk;
        if (left <= 0 || !game.running) resolve(snapshot()); else setTimeout(go, 0);
      };
      setTimeout(go, 0);
    }),
    place: (s, lat, h = 0, n = 1) => {
      const x = game.course.supportAt(s, lat, h, n);
      if (!x) throw new Error(`no surface at ${s},${lat},${h}`);
      Object.assign(game.sim.p, { state: "stuck", s, lat, h, n, surfaceId: x.id, vh: 0, latVel: 0, travel: null, hitstop: 0, adhesion: game.sim.t.peel.adhesionMax });
      if (game.sim.p.speed < 20) game.sim.p.speed = 32;
      game.cam.reset();
    },
    setAutopilot: (on) => { game.autopilot = on; },
    tunables,
    events: () => game.eventLog.slice()
  };
}
