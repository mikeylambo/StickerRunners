/**
 * Placeholder synthesized SFX (Web Audio). Gameplay emits semantic events; this layer picks sounds.
 *  peel  — soft vinyl "thhp": band-passed noise sweeping down
 *  slap  — punchy SLAP: noise crack + low thump + click
 *  whiff — hollow: resonant band sweep + falling sine, quiet
 * plus kick, land, wrap, hazard, fallout.
 */
export type SfxId = "peel" | "slap" | "whiff" | "kick" | "land" | "wrap" | "hazard" | "fallout" | "restick";

export class Sfx {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  volume = 0.7;

  /** Call from a user gesture; safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      this.out.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = seed / 2147483648 - 1; }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  play(id: SfxId, intensity = 1): void {
    const c = this.ctx; const out = this.out;
    if (!c || !out || c.state !== "running" || this.volume <= 0) return;
    out.gain.value = this.volume;
    const t = c.currentTime;
    switch (id) {
      case "peel": this.noiseSweep(t, 2600, 500, 0.11, 1.4, 0.55); break;
      case "slap": {
        this.noiseSweep(t, 3000, 1400, 0.07, 0.7, 0.9 * intensity, "highpass");
        this.tone(t, "sine", 170, 42, 0.16, 1.0 * intensity);
        this.tone(t, "square", 1400, 900, 0.018, 0.25 * intensity);
        break;
      }
      case "whiff": this.noiseSweep(t, 380, 1100, 0.32, 9, 0.35); this.tone(t, "sine", 260, 110, 0.36, 0.18); break;
      case "kick": this.noiseSweep(t, 400, 2400, 0.1, 1.2, 0.45); this.tone(t, "triangle", 180, 420, 0.09, 0.35); break;
      case "land": this.tone(t, "sine", 130, 60, 0.09, 0.45); this.noiseSweep(t, 900, 300, 0.05, 1, 0.25); break;
      case "wrap": this.noiseSweep(t, 900, 2800, 0.12, 2, 0.4); this.tone(t, "sine", 300, 600, 0.1, 0.2); break;
      case "hazard": this.tone(t, "square", 110, 60, 0.14, 0.4); this.noiseSweep(t, 1800, 400, 0.14, 0.8, 0.5); break;
      case "fallout": this.tone(t, "sine", 620, 70, 0.7, 0.3); break;
      case "restick": this.noiseSweep(t, 600, 2000, 0.08, 1.5, 0.35); this.tone(t, "sine", 150, 60, 0.1, 0.5); break;
    }
  }

  private env(t: number, dur: number, peak: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.out!);
    return g;
  }

  private noiseSweep(t: number, f0: number, f1: number, dur: number, q: number, peak: number, type: BiquadFilterType = "bandpass"): void {
    const c = this.ctx!;
    const src = c.createBufferSource(); src.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    src.connect(f).connect(this.env(t, dur, peak));
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number): void {
    const c = this.ctx!;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(this.env(t, dur, peak));
    o.start(t); o.stop(t + dur + 0.02);
  }
}
