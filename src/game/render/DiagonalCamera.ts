/**
 * Fixed 3/4 diagonal camera (GDD §15): perspective FOV 22°, pitch 38°, track yaw 30°.
 * The camera sits on the rail side looking across the ribbon and 30° down-track, so the road runs
 * bottom-left → top-right with the rail on the lower edge and the void above.
 * Its heading follows the track tangent (smoothed) so curves keep the diagonal (DECISIONS).
 * Target = a point leadBase + speed·leadTime ahead of Tack, critically damped over smoothTime.
 */
import * as THREE from "three";
import type { Track } from "../sim/Track";
import { camera as camT, feel } from "../../../config/tuning";

/** Critically damped spring (Game Programming Gems 4, "smooth damp"). */
function smoothDamp(cur: number, target: number, vel: { v: number }, smoothTime: number, dt: number): number {
  const st = Math.max(1e-4, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

export class DiagonalCamera {
  readonly camera = new THREE.PerspectiveCamera(22, 16 / 9, 1, 4000);
  private readonly target = new THREE.Vector3();
  private readonly vel = [{ v: 0 }, { v: 0 }, { v: 0 }];
  private heading = 0;
  private readonly headingVel = { v: 0 };
  private primed = false;
  private shakeFrames = 0;
  private shakePx = 0;
  private punch = 0;
  viewportHeightPx = 720;
  /** Resolved orientation (Game decides from ?orient / panel / device aspect). Landscape = the GDD camera, unchanged. */
  portrait = false;

  /** Active framing: landscape uses the GDD values; portrait swings behind Tack so travel is up-screen. */
  get params(): { fov: number; yawDeg: number; distance: number; leadBase: number } {
    return this.portrait
      ? { fov: camT.portraitFov, yawDeg: camT.portraitYawDeg, distance: camT.portraitDistance, leadBase: camT.portraitLeadBase }
      : { fov: camT.fov, yawDeg: camT.yawDeg, distance: camT.distance, leadBase: camT.leadBase };
  }

  constructor(private readonly track: Track) {}

  reset(): void { this.primed = false; this.shakeFrames = 0; this.punch = 0; }

  shake(px: number, frames: number): void { this.shakePx = Math.max(this.shakePx, px); this.shakeFrames = Math.max(this.shakeFrames, frames); }
  zoomPunch(): void { this.punch = 2; }

  /** World metres per screen pixel at the target distance. */
  get worldPerPx(): number {
    return (2 * this.params.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) / Math.max(1, this.viewportHeightPx);
  }

  /** Fraction of Tack's height the camera target follows (0 on the flat ribbon; the web stage sets it). */
  heightFollow = 0;

  update(dt: number, s: number, lat: number, speed: number, reducedShake = 1, height = 0): void {
    const tr = this.track;
    const P = this.params;
    const st = s + P.leadBase + speed * camT.leadTime;
    const f = tr.frameAt(st);
    const goal = tr.toWorld(st, lat * camT.lateralFollow, height * this.heightFollow, f);
    // unwrap heading so smoothing never spins the long way round
    let h = tr.frameAt(s).heading;
    while (h - this.heading > Math.PI) h -= Math.PI * 2;
    while (h - this.heading < -Math.PI) h += Math.PI * 2;
    if (!this.primed) {
      this.target.set(goal.x, goal.y, goal.z);
      this.heading = h;
      this.vel.forEach((v) => (v.v = 0)); this.headingVel.v = 0;
      this.primed = true;
    } else {
      this.target.x = smoothDamp(this.target.x, goal.x, this.vel[0], camT.smoothTime, dt);
      this.target.y = smoothDamp(this.target.y, goal.y, this.vel[1], camT.smoothTime, dt);
      this.target.z = smoothDamp(this.target.z, goal.z, this.vel[2], camT.smoothTime, dt);
      this.heading = smoothDamp(this.heading, h, this.headingVel, camT.yawSmoothTime, dt);
    }
    const yaw = THREE.MathUtils.degToRad(P.yawDeg);
    const pitch = THREE.MathUtils.degToRad(camT.pitchDeg);
    const Th = new THREE.Vector3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    const Rh = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const viewH = Rh.clone().multiplyScalar(-Math.cos(yaw)).addScaledVector(Th, Math.sin(yaw)).normalize();
    const viewDir = viewH.multiplyScalar(Math.cos(pitch)).add(new THREE.Vector3(0, -Math.sin(pitch), 0)).normalize();
    const c = this.camera;
    c.fov = P.fov - (this.punch > 0 ? feel.zoomPunchDeg : 0);
    if (this.punch > 0) this.punch--;
    c.position.copy(this.target).addScaledVector(viewDir, -P.distance);
    c.up.set(0, 1, 0);
    c.lookAt(this.target);
    if (this.shakeFrames > 0) {
      const px = this.shakePx * reducedShake * this.worldPerPx;
      c.translateX((Math.random() * 2 - 1) * px);
      c.translateY((Math.random() * 2 - 1) * px);
      this.shakeFrames--;
      if (this.shakeFrames === 0) this.shakePx = 0;
    }
    c.updateProjectionMatrix();
  }
}
