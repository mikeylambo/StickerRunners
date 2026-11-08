/**
 * Greybox cosmos: a gradient skydome that follows the camera and two star layers
 * (a far layer locked to the camera, a near layer fixed in the world for parallax).
 * Value rule (GDD §23): void is the darkest thing on screen.
 */
import * as THREE from "three";
import { mulberry32 } from "../sim/rng";

export class Backdrop {
  readonly group = new THREE.Group();
  private readonly sky: THREE.Mesh;
  private readonly far: THREE.Points;

  constructor(center: THREE.Vector3, extent: number) {
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vDir; void main(){
        float t = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 low = vec3(0.02, 0.01, 0.05); vec3 mid = vec3(0.10, 0.04, 0.20); vec3 high = vec3(0.03, 0.06, 0.16);
        vec3 c = t < 0.5 ? mix(low, mid, t * 2.0) : mix(mid, high, (t - 0.5) * 2.0);
        gl_FragColor = vec4(c, 1.0); }`
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), skyMat);
    this.sky.renderOrder = -10;
    const rnd = mulberry32(7);
    const stars = (n: number, place: (i: number) => [number, number, number]) => {
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos.set(place(i), i * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return g;
    };
    this.far = new THREE.Points(
      stars(1800, () => {
        const u = rnd() * 2 - 1; const a = rnd() * Math.PI * 2; const r = Math.sqrt(1 - u * u);
        return [Math.cos(a) * r * 2500, u * 2500, Math.sin(a) * r * 2500];
      }),
      new THREE.PointsMaterial({ color: "#c9c4ff", size: 1.6, sizeAttenuation: false, depthWrite: false })
    );
    const near = new THREE.Points(
      stars(2500, () => [center.x + (rnd() - 0.5) * extent, center.y - 40 - rnd() * 260, center.z + (rnd() - 0.5) * extent]),
      new THREE.PointsMaterial({ color: "#8f86d8", size: 2.2, sizeAttenuation: false, depthWrite: false })
    );
    this.group.add(this.sky, this.far, near);
  }

  follow(cam: THREE.Camera): void {
    this.sky.position.copy(cam.position);
    this.far.position.copy(cam.position);
  }
}
