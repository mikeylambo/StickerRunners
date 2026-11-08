/**
 * Spline ribbon in track space. Pure math (no Three.js) so the sim and tests can use it.
 *
 * The centreline is integrated from authored segments (length, heading change, pitch) and sampled
 * every metre. Each sample carries an orthonormal frame:
 *   T = forward tangent, R = lateral (+ = rail side, screen lower-right), U = surface normal.
 * Track space (s, lateral, height) maps to world as  P(s) + R(s)·lateral + U(s)·height.
 * World axes follow Three.js: Y up.
 */

export interface V3 { x: number; y: number; z: number }

export interface TrackSegment {
  /** Length in metres. */
  length: number;
  /** Total heading change over the segment, degrees. + = left turn (towards the void side). */
  turnDeg: number;
}

export interface TrackFrame {
  pos: V3;
  T: V3;
  R: V3;
  U: V3;
  /** Heading in radians (rotation about world Y; 0 = +X). */
  heading: number;
}

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3, k = 1): V3 => v(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
const cross = (a: V3, b: V3): V3 => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const norm = (a: V3): V3 => { const l = Math.hypot(a.x, a.y, a.z) || 1; return v(a.x / l, a.y / l, a.z / l); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Track {
  readonly length: number;
  private readonly step = 1;
  private readonly px: Float64Array;
  private readonly py: Float64Array;
  private readonly pz: Float64Array;
  private readonly hd: Float64Array;
  private readonly pt: Float64Array;

  constructor(segments: TrackSegment[], elevation: (s: number) => number = () => 0) {
    this.length = segments.reduce((a, s) => a + s.length, 0);
    const n = Math.floor(this.length / this.step) + 2;
    this.px = new Float64Array(n); this.py = new Float64Array(n); this.pz = new Float64Array(n);
    this.hd = new Float64Array(n); this.pt = new Float64Array(n);

    // Heading as a function of s (piecewise-linear → constant curvature arcs).
    const headingAt = (s: number): number => {
      let acc = 0; let h = 0;
      for (const seg of segments) {
        const turn = (seg.turnDeg * Math.PI) / 180;
        if (s <= acc + seg.length) return h + turn * ((s - acc) / seg.length);
        acc += seg.length; h += turn;
      }
      return h;
    };
    let x = 0; let z = 0;
    for (let i = 0; i < n; i++) {
      const s = i * this.step;
      const heading = headingAt(s);
      const y = elevation(s);
      const dy = (elevation(s + 0.5) - elevation(s - 0.5));
      this.px[i] = x; this.py[i] = y; this.pz[i] = z;
      this.hd[i] = heading;
      this.pt[i] = Math.atan2(dy, 1);
      // integrate the horizontal position with a midpoint heading
      const hm = headingAt(s + this.step * 0.5);
      x += Math.cos(hm) * this.step;
      z -= Math.sin(hm) * this.step;
    }
  }

  private sample(s: number): { i: number; t: number } {
    const c = Math.min(Math.max(s, 0), this.length) / this.step;
    const i = Math.min(Math.floor(c), this.px.length - 2);
    return { i, t: c - i };
  }

  frameAt(s: number): TrackFrame {
    const { i, t } = this.sample(s);
    const pos = v(lerp(this.px[i], this.px[i + 1], t), lerp(this.py[i], this.py[i + 1], t), lerp(this.pz[i], this.pz[i + 1], t));
    // extrapolate past the ends so camera lead never stalls
    if (s > this.length) Object.assign(pos, add(pos, this.tangent(this.hd[this.hd.length - 1], 0), s - this.length));
    if (s < 0) Object.assign(pos, add(pos, this.tangent(this.hd[0], 0), s));
    const heading = lerp(this.hd[i], this.hd[i + 1], t);
    const pitch = lerp(this.pt[i], this.pt[i + 1], t);
    const T = this.tangent(heading, pitch);
    const R = norm(cross(T, v(0, 1, 0)));
    const U = norm(cross(R, T));
    return { pos, T, R, U, heading };
  }

  private tangent(heading: number, pitch: number): V3 {
    return norm(v(Math.cos(pitch) * Math.cos(heading), Math.sin(pitch), -Math.cos(pitch) * Math.sin(heading)));
  }

  toWorld(s: number, lateral: number, height: number, f: TrackFrame = this.frameAt(s)): V3 {
    return add(add(f.pos, f.R, lateral), f.U, height);
  }
}
