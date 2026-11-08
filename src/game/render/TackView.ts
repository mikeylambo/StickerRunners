/**
 * Tack on screen: the camera-locked die-cut billboard plus its contact shadow.
 * Everything here is read from the sim (state, adhesion, normal) — the sticker is the HUD:
 *  - curl = peel state, straightening as adhesion runs out; flutter in the last 0.3 s
 *  - shadow = hard ellipse when stuck; detaches and softens with height when peeled
 *  - underside riding = flipped sprite, dimmed (behind the sheet)
 */
import * as THREE from "three";
import type { Course } from "../sim/Course";
import type { Player } from "../sim/Sim";
import { createStickerMaterial, createStickerQuad } from "./StickerMaterial";
import { createShadow, placeDecal } from "./SurfaceDecals";
import { sprite } from "./Atlas";
import { look, peel as peelT, feel } from "../../../config/tuning";

export interface TackPose { s: number; lat: number; h: number }

export class TackView {
  readonly group = new THREE.Group();
  private readonly quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly shadow = createShadow();
  private curl = 0;
  private squash = 0;
  private flip = 1;
  private time = 0;

  constructor(private readonly course: Course) {
    this.quad = new THREE.Mesh(createStickerQuad(), createStickerMaterial(sprite("tack.idle")));
    this.quad.renderOrder = 10;
    this.quad.frustumCulled = false;
    this.group.add(this.shadow, this.quad);
  }

  slapped(): void { this.squash = 1; this.curl = 0; } // slap = flat instantly

  /**
   * @param worldPerPx world metres per screen pixel at Tack's depth (for the px-exact border).
   */
  update(dt: number, pose: TackPose, p: Player, camera: THREE.Camera, worldPerPx: number): void {
    this.time += dt;
    const tr = this.course.track;
    const u = this.quad.material.uniforms;
    const pos = tr.toWorld(pose.s, pose.lat, pose.h);
    this.quad.position.set(pos.x, pos.y, pos.z);
    this.quad.quaternion.copy(camera.quaternion);

    // flip when hanging from the underside (n = -1 while stuck there or peeled from it)
    const under = p.n === -1 && p.state !== "falling" && p.state !== "respawning";
    this.flip = under ? -1 : 1; // instant: a tween would pass through zero scale

    const hgt = look.tackHeight;
    const quadH = hgt / 0.62; // sprite body is ~62% of the padded texture
    this.squash = Math.max(0, this.squash - dt / 0.12);
    const sq = feel.slapSquash * this.squash;
    this.quad.scale.set(quadH, quadH * this.flip, quadH);
    u.uSquash.value.set(1 + sq, 1 - sq);

    // die-cut border: outline/25 px (GDD §12), keyline 1 px — converted from screen px to quad UV
    const quadPx = quadH / Math.max(worldPerPx, 1e-6);
    const borderPx = look.outline / 25;
    u.uBorder.value.set(borderPx / quadPx, borderPx / quadPx);
    u.uKey.value.set(look.keylinePx / quadPx, look.keylinePx / quadPx);

    // peel curl: bends while peeled, straightens as adhesion runs out; flutters at the end
    const peeled = p.state === "peeled";
    const adh = p.adhesion / Math.max(peelT.adhesionMax, 1e-6);
    const target = peeled ? 0.18 + 0.82 * adh : p.state === "falling" ? 0 : 0;
    this.curl += (target - this.curl) * Math.min(1, dt * (peeled ? 40 : 18));
    u.uCurl.value = this.curl;
    u.uFold.value = this.curl * 0.14;
    u.uFlutter.value = peeled && p.adhesion <= peelT.flutterAt ? 0.6 : 0;
    u.uTime.value = this.time;
    u.uDim.value = under ? 0.35 : 0;
    u.uFlash.value = 0;
    // invulnerability after a hit: border flicker (GDD §11)
    u.uHidden.value = p.invuln > 0 && Math.floor(this.time * 20) % 2 === 0 ? 1 : 0;
    this.quad.visible = !(p.state === "respawning" && Math.floor(this.time * 12) % 2 === 0 && p.timer > 0.3);

    // contact shadow on whatever surface is straight beneath (along the face normal)
    const n: 1 | -1 = p.n;
    const below = this.course.surfaceBeneath(pose.s, pose.lat, pose.h, n);
    if (!below || p.state === "respawning") { this.shadow.visible = false; return; }
    const gap = Math.abs(pose.h - below.h);
    this.shadow.visible = true;
    const soft = Math.min(0.85, gap * 0.55);
    const alpha = Math.max(0.12, 0.78 - gap * 0.28);
    const size = 1 - Math.min(0.35, gap * 0.12);
    this.shadow.material.uniforms.uSoft.value = soft;
    this.shadow.material.uniforms.uAlpha.value = alpha;
    placeDecal(this.shadow, tr, pose.s, pose.lat, below.h, below.n, 0.6 * size * hgt, 0.42 * size * hgt);
  }
}
