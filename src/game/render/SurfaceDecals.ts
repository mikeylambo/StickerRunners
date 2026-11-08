/**
 * Flat decals laid in a surface's plane: Tack's contact shadow and the Slap Ring.
 * Both orient to the track frame at their s, flipped for the underside.
 */
import * as THREE from "three";
import type { Track } from "../sim/Track";

const decalVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const shadowFrag = /* glsl */ `
uniform float uSoft; uniform float uAlpha;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = uAlpha * (1.0 - smoothstep(1.0 - uSoft - 0.03, 1.0, r));
  if (a <= 0.003) discard;
  gl_FragColor = vec4(0.04, 0.03, 0.08, a);
}`;

// Slap Ring: a die-cut ring stamp — ivory band with a dark keyline both sides.
const ringFrag = /* glsl */ `
uniform float uProg; uniform float uKey; uniform float uBand;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float outer = 1.0; float inner = 1.0 - uBand;
  float a = 1.0 - uProg * uProg;
  if (r > outer || r < inner - uKey) discard;
  vec3 c = (r > outer - uKey || r < inner) ? vec3(0.07, 0.05, 0.11) : vec3(1.0, 0.98, 0.94);
  gl_FragColor = vec4(c, a);
}`;

const tmpM = new THREE.Matrix4();
const vT = new THREE.Vector3(); const vR = new THREE.Vector3(); const vU = new THREE.Vector3();

/** Place a unit XY decal in the surface plane at (s, lat, h); n = -1 faces down (underside). */
export function placeDecal(o: THREE.Object3D, track: Track, s: number, lat: number, h: number, n: 1 | -1, sx: number, sy: number): void {
  const f = track.frameAt(s);
  vT.set(f.T.x, f.T.y, f.T.z); vR.set(f.R.x, f.R.y, f.R.z); vU.set(f.U.x, f.U.y, f.U.z).multiplyScalar(n);
  // basis: x = T, y = U×T (= -R on top), z = U (decal normal)
  const y = new THREE.Vector3().crossVectors(vU, vT);
  tmpM.makeBasis(vT, y, vU);
  o.quaternion.setFromRotationMatrix(tmpM);
  const p = track.toWorld(s, lat, h + n * 0.03, f);
  o.position.set(p.x, p.y, p.z);
  o.scale.set(sx, sy, 1);
}

export function createShadow(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const m = new THREE.ShaderMaterial({
    vertexShader: decalVert, fragmentShader: shadowFrag, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uSoft: { value: 0 }, uAlpha: { value: 0.75 } }
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
}

export class SlapRings {
  readonly group = new THREE.Group();
  private readonly pool: Array<{ mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; age: number; life: number; s: number; lat: number; h: number; n: 1 | -1; size: number }> = [];

  constructor(private readonly track: Track) {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.ShaderMaterial({
        vertexShader: decalVert, fragmentShader: ringFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
        uniforms: { uProg: { value: 0 }, uKey: { value: 0.05 }, uBand: { value: 0.22 } }
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
      mesh.visible = false;
      this.group.add(mesh);
      this.pool.push({ mesh, age: 0, life: 0, s: 0, lat: 0, h: 0, n: 1, size: 1 });
    }
  }

  spawn(s: number, lat: number, h: number, n: 1 | -1, life: number, size = 1): void {
    const oldest = this.pool.reduce((a, b) => (a.age / a.life >= b.age / b.life ? a : b));
    const slot = this.pool.find((p) => !p.mesh.visible) ?? oldest;
    Object.assign(slot, { age: 0, life, s, lat, h, n, size });
    slot.mesh.visible = true;
  }

  update(dt: number): void {
    for (const r of this.pool) {
      if (!r.mesh.visible) continue;
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) { r.mesh.visible = false; continue; }
      const ease = 1 - Math.pow(1 - k, 3);
      const d = (0.6 + ease * 2.6) * r.size;
      placeDecal(r.mesh, this.track, r.s, r.lat, r.h, r.n, d, d);
      r.mesh.material.uniforms.uProg.value = k;
    }
  }

  clear(): void { for (const r of this.pool) r.mesh.visible = false; }
}
