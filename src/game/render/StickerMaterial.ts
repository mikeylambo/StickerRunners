/**
 * Die-cut sticker billboard shader (GDD §23 Rendering Recipe).
 *  - Border by alpha dilation in the fragment shader: thickness uniform = outline/25 px (screen px),
 *    then a 1 px dark keyline outside it.
 *  - Peel curl: vertex bend on the quad's bottom edge toward the camera (curl amount = peel state).
 * Written as a generic module so it can contribute back to the Shell (GDD §29.2).
 */
import * as THREE from "three";

const vert = /* glsl */ `
uniform float uCurl;
uniform float uFlutter;
uniform float uTime;
uniform vec2 uSquash;
uniform float uFoot;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;            // unit quad, x in [-0.5,0.5], y in [0,1] (bottom edge at the contact point)
  p.x *= uSquash.x; p.y *= uSquash.y;
  const float line = 0.45;      // curl region = bottom 45% of the quad
  float k = uCurl * 2.5 + uFlutter * sin(uTime * 46.0) * 1.2;
  if (uv.y < line && abs(k) > 0.001) {
    float d = (line - uv.y) * uSquash.y;
    float a = d * k;
    p.y = line * uSquash.y - sin(a) / k;
    p.z = (1.0 - cos(a)) / k;
  }
  p.y -= uFoot * uSquash.y;   // feet (not the padded quad edge) sit on the contact point
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const frag = /* glsl */ `
uniform sampler2D map;
uniform vec2 uBorder;   // border radius in UV (x, y)
uniform vec2 uKey;      // keyline width in UV
uniform vec3 uBorderColor;
uniform vec3 uKeyColor;
uniform float uFlash;
uniform float uHidden;
uniform float uDim;
uniform vec3 uBackColor;
uniform float uFold;
uniform float uFootUv;
varying vec2 vUv;
float A(vec2 uv) { return texture2D(map, uv).a; }
float dilate(vec2 uv, vec2 r) {
  float m = 0.0;
  for (int i = 0; i < 20; i++) {
    float a = float(i) * 0.314159;
    vec2 o = vec2(cos(a), sin(a));
    m = max(m, A(uv + o * r));
    m = max(m, A(uv + o * r * 0.55));
  }
  return m;
}
void main() {
  if (uHidden > 0.5) discard;
  vec4 c = texture2D(map, vUv);
  // Peel fold: the bottom edge lifts and folds back over the print, showing the backing paper.
  // Fold depth = curl (shrinks as adhesion runs out), angled so the right corner leads.
  if (uFold > 0.001) {
    vec2 fn = normalize(vec2(-0.28, 1.0));
    float d = dot(vUv - vec2(0.5, uFootUv + uFold), fn);
    if (d < 0.0) discard;                                  // the lifted flap is no longer here…
    vec2 src = vUv - 2.0 * d * fn;                         // …it is folded over, mirrored about the crease
    if (d < 0.6) {
      if (A(src) > 0.5 || dilate(src, uBorder) > 0.5) { gl_FragColor = vec4(uBackColor * (1.0 - d * 0.6), 1.0); return; }
      if (dilate(src, uBorder + uKey) > 0.5) { gl_FragColor = vec4(uKeyColor, 1.0); return; }
    }
  }
  // curled past 90°: we see the sticker's backing paper, not the print (the readable peel cue)
  bool back = !gl_FrontFacing; // three.js already flips winding for the mirrored (underside) sprite
  if (back) {
    if (c.a > 0.5 || (uBorder.x > 0.0 && dilate(vUv, uBorder) > 0.5)) { gl_FragColor = vec4(uBackColor, 1.0); return; }
    if (dilate(vUv, uBorder + uKey) > 0.5) { gl_FragColor = vec4(uKeyColor, 1.0); return; }
    discard;
  }
  if (c.a > 0.5) { gl_FragColor = vec4(mix(c.rgb * (1.0 - uDim), vec3(1.0), uFlash), 1.0); return; }
  if (uBorder.x > 0.0 && dilate(vUv, uBorder) > 0.5) { gl_FragColor = vec4(uBorderColor * (1.0 - uDim * 0.6), 1.0); return; }
  if (dilate(vUv, uBorder + uKey) > 0.5) { gl_FragColor = vec4(uKeyColor, 1.0); return; }
  discard;
}`;

export function createStickerMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.DoubleSide,
    depthTest: false, // the sticker is the HUD: always readable, even riding the underside (DECISIONS)
    depthWrite: false,
    uniforms: {
      map: { value: map },
      uBorder: { value: new THREE.Vector2(0.03, 0.03) },
      uKey: { value: new THREE.Vector2(0.008, 0.008) },
      uBorderColor: { value: new THREE.Color("#fffaf0") }, // Tack's border: the lightest thing on screen
      uKeyColor: { value: new THREE.Color("#120e1c") },
      uCurl: { value: 0 },
      uFlutter: { value: 0 },
      uTime: { value: 0 },
      uSquash: { value: new THREE.Vector2(1, 1) },
      uFlash: { value: 0 },
      uHidden: { value: 0 },
      uDim: { value: 0 },
      uFoot: { value: 0.14 },
      uFold: { value: 0 },
      uFootUv: { value: 0.15 },
      uBackColor: { value: new THREE.Color("#d9d2c4") }
    }
  });
}

/** Unit quad with its bottom edge at the origin, subdivided vertically for the curl bend. */
export function createStickerQuad(): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(1, 1, 1, 24);
  g.translate(0, 0.5, 0);
  return g;
}
