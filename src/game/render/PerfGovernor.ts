/**
 * Adaptive resolution: if the average frame interval stays above the budget for 2 s, drop the
 * pixel ratio a step (never below render.minPixelRatio). Presentation only; the sim is fixed 60 Hz.
 */
import { render as R } from "../../../config/tuning";

export class PerfGovernor {
  avgMs = 16.7;
  private overFor = 0;
  ratio: number;

  constructor(deviceRatio: number) { this.ratio = Math.min(deviceRatio, R.maxPixelRatio); }

  /** Returns a new pixel ratio when it should change, else null. */
  sample(intervalMs: number): number | null {
    if (!(intervalMs > 0) || intervalMs > 250) return null; // tab switches, debugger pauses
    this.avgMs += (intervalMs - this.avgMs) * 0.05;
    const cap = Math.min(this.ratio, R.maxPixelRatio);
    if (cap !== this.ratio) { this.ratio = cap; return cap; }
    if (this.avgMs > R.frameBudgetMs) this.overFor += intervalMs / 1000; else this.overFor = 0;
    if (this.overFor >= 2 && this.ratio > R.minPixelRatio) {
      this.overFor = 0;
      this.ratio = Math.max(R.minPixelRatio, this.ratio - 0.25);
      return this.ratio;
    }
    return null;
  }
}
