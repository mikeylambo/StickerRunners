#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const get = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] ?? fallback : fallback;
};

const shellRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shellVersion = JSON.parse(fs.readFileSync(path.join(shellRoot, "package.json"), "utf8")).version;
const shellRepo = "mikeylambo/Web-Game-Shell-v1.02";
const gameId = get("id", "new-slu-game");
const gameName = get("name", gameId);
const renderer = get("renderer", "three");
const frames = get("frames", "arcade").split(",").map(x => x.trim()).filter(Boolean);
const out = path.resolve(get("out", `./${gameId}`));
const lookMode = get("look", renderer === "three" ? "slu" : "none");
const useLook = renderer === "three" && lookMode === "slu";
const cameraMode = frames.includes("fps") ? "firstPerson" : frames.includes("character-action") || frames.includes("high-mobility-combat") ? "springArm" : frames.includes("arena-combat") || frames.includes("survivor") ? "arena" : frames.includes("platformer") ? "follow2d" : "springArm";

const assembly = {
  survivor: "createSurvivorAssembly",
  arcade: "createArcadeAssembly",
  "character-action": "createCharacterActionAssembly",
  "high-mobility-combat": "createHighMobilityCombatAssembly",
  "arena-combat": "createArenaCombatAssembly",
  vehicle: "createVehicleAssembly",
  fps: "createFPSAssembly",
  puzzle: "createPuzzleAssembly",
  rpg: "createRPGAssembly",
  strategy: "createStrategyAssembly",
  platformer: "createPlatformerAssembly",
  "party-multiplayer": "createPartyMultiplayerAssembly"
};
const adapter = {
  pixi: "PixiAdapter",
  three: "createThreeStarterAdapter",
  babylon: "createBabylonStarterAdapter",
  phaser: "PhaserAdapter",
  canvas2d: "createCanvas2DStarterAdapter",
  dom: "createDOMStarterAdapter"
};

if (!adapter[renderer]) {
  console.error(`Unknown renderer: ${renderer}`);
  process.exit(1);
}
const unknownFrames = frames.filter((x) => !assembly[x]);
if (unknownFrames.length) {
  console.error(`Unknown frame(s): ${unknownFrames.join(", ")}`);
  process.exit(1);
}

const selected = frames.map(x => assembly[x]).filter(Boolean);
fs.mkdirSync(path.join(out, "src"), { recursive: true });

const rendererLine =
 renderer === "pixi"
 ? `const rendererAdapter = new PixiAdapter({}); // attach your Pixi application lifecycle hooks`
 : renderer === "dom"
 ? `const rendererAdapter = createDOMStarterAdapter(document.getElementById("game")!);`
 : renderer === "phaser"
 ? `const rendererAdapter = new PhaserAdapter(); // wire your Phaser.Game hooks here`
 : `const rendererAdapter = ${adapter[renderer]}(document.getElementById("game-canvas") as HTMLCanvasElement);`;

const imports = [...selected, adapter[renderer], "mountBrowserDevConsole"].join(",\n  ");
const proceduralImport = renderer === "three"
  ? `import { bootProceduralVisualManifest } from "./art/procedural/visualManifest";\n`
  : "";
const proceduralBoot = renderer === "three" ? `\nbootProceduralVisualManifest();\n` : "";
const lookImport = useLook ? `import { startLookScene } from "./look/startLookScene";\n` : "";
const lookBoot = useLook ? `\nconst lookScene = await startLookScene(document.getElementById("game-canvas") as HTMLCanvasElement);\n` : "";

fs.writeFileSync(path.join(out, "src/main.ts"), `${proceduralImport}${lookImport}import {
  createGameApp,
  ${imports}
} from "@slu/web-shell";

${rendererLine}
${proceduralBoot}${lookBoot}
const app = await createGameApp({
  gameId: "${gameId}",
  gameName: "${gameName}",
  version: "0.1.0",
  renderer: rendererAdapter,
  root: document.getElementById("ui")!,
  assemblies: [
    ${selected.map(f => `(shell) => ${f}({ shell })`).join(",\n    ")}
  ]
});

if (new URLSearchParams(location.search).get("dev") === "1") {
  mountBrowserDevConsole(app.shell.studio.dev, { title: "${gameName} DEV" });
}

console.log("SLU game ready", app${useLook ? ", lookScene" : ""});
`);

if (renderer === "three") {
  const proceduralDir = path.join(out, "src", "art", "procedural");
  const modelsDir = path.join(proceduralDir, "models");
  fs.mkdirSync(modelsDir, { recursive: true });

  fs.writeFileSync(path.join(proceduralDir, "ProceduralVisualRegistry.ts"), `import * as THREE from "three";
import { createVisualRegistry, type VisualRegistration } from "@slu/web-shell";

export interface ProceduralVisualContext {
  key: string;
  anchor?: THREE.Object3D;
  metadata?: Readonly<Record<string, unknown>>;
}

export type ProceduralVisualRegistration = VisualRegistration<THREE.Group, ProceduralVisualContext>;
export const proceduralVisuals = createVisualRegistry<THREE.Group, ProceduralVisualContext>();

export function registerProceduralVisual(key: string, registration: ProceduralVisualRegistration): void {
  proceduralVisuals.register(key, registration);
}

export function replaceProceduralVisual(key: string, registration: ProceduralVisualRegistration): void {
  proceduralVisuals.replace(key, registration);
}
`);

  fs.writeFileSync(path.join(proceduralDir, "attachProceduralVisual.ts"), `import * as THREE from "three";
import { proceduralVisuals, type ProceduralVisualContext } from "./ProceduralVisualRegistry";

export function attachProceduralVisual(
  anchor: THREE.Object3D,
  key: string,
  metadata?: Readonly<Record<string, unknown>>
): THREE.Group | null {
  const context: ProceduralVisualContext = { key, anchor, metadata };
  const instance = proceduralVisuals.create(key, context);
  if (!instance) return null;
  const visual = instance.visual;
  visual.userData.sluPresentationOnly = true;
  visual.userData.sluVisualKey = key;
  visual.userData.sluVisualInstance = instance;
  visual.traverse((child) => {
    child.userData.sluPresentationOnly = true;
    child.userData.sluVisualKey = key;
  });
  anchor.add(visual);
  return visual;
}

export function detachProceduralVisual(visual: THREE.Object3D): void {
  const instance = visual.userData.sluVisualInstance as { dispose?: () => void } | undefined;
  instance?.dispose?.();
  visual.removeFromParent();
  visual.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}
`);

  fs.writeFileSync(path.join(proceduralDir, "visualManifest.ts"), `import { proceduralVisuals } from "./ProceduralVisualRegistry";

/**
 * Single registration point for approved image-to-Three.js assets.
 * Put generated factories under ./models and register stable keys here.
 */
export function bootProceduralVisualManifest(): void {
  const keys = proceduralVisuals.keys();
  if (new URLSearchParams(location.search).get("dev") === "1" && keys.length > 0) {
    console.info("SLU procedural visuals", keys);
  }
}
`);

  fs.writeFileSync(path.join(modelsDir, "README.md"), `# Procedural models

Put approved img2threejs-style THREE.Group factories here, then register them in ../visualManifest.ts.
Keep gameplay collision and authoritative state outside presentation geometry.
`);
}

if (useLook) {
  fs.mkdirSync(path.join(out, "src", "look"), { recursive: true });
  fs.mkdirSync(path.join(out, "tuning"), { recursive: true });
  fs.writeFileSync(path.join(out, "tuning", ".gitkeep"), "");
  fs.writeFileSync(path.join(out, "vite.config.ts"), `import { defineConfig } from "vite";
import { sluTuning } from "@slu/web-shell/look/vite";

export default defineConfig({ plugins: [sluTuning()] });
`);
  fs.writeFileSync(path.join(out, "src", "look", "startLookScene.ts"), `import * as THREE from "three";
import { createLook } from "@slu/web-shell/look/three";
import { loadTuningCanon } from "@slu/web-shell/tuning";
import { CameraRig, FeelDirector } from "@slu/web-shell/feel";
import { applyCameraFrame } from "@slu/web-shell/feel/three";

/** SLU Look starter: Look Kit materials, post stack, feel bundles and the frame's camera rig. */
export async function startLookScene(canvas: HTMLCanvasElement) {
  // tuning/*.json is canon in every build; the panel only ships in dev builds opened with ?tune.
  loadTuningCanon(import.meta.glob("/tuning/*.json", { eager: true }));
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("tune")) {
    const { mountTuningPanel } = await import("@slu/web-shell/tuning/panel");
    mountTuningPanel({ startOpen: true, resolveColor: (v) => look.palette.resolve(v), colorTokens: () => look.palette.tokens() });
  }
  const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const look = createLook({ renderer, scene, camera });
  scene.background = new THREE.Color(look.palette.get("void.deep"));

  scene.add(new THREE.HemisphereLight(look.palette.get("soul"), look.palette.get("void.deep"), 0.6));
  const key = new THREE.DirectionalLight(look.palette.get("highlight"), 2.4);
  key.position.set(4, 8, 5); key.castShadow = true; scene.add(key);
  const rim = new THREE.DirectionalLight(look.palette.get("edge"), 1.8);
  rim.position.set(-4, 3, -5); scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), look.material("slu.lit", { color: "void" }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const player = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1, 8, 24), look.material("slu.rim"));
  player.position.y = 0.85; player.castShadow = true; scene.add(player);
  look.outline(player);
  const relic = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 4), look.material("slu.voidglass"));
  relic.position.set(2, 1.2, -1); scene.add(relic);

  const rig = new CameraRig();
  rig.setMode("${cameraMode}", 0);
  const feel = new FeelDirector({
    vfx: (id, c) => { look.play(id, { position: c.position ?? player.position, scale: c.scale }); },
    post: (id, amount) => look.pulse(id, amount),
    flash: (token, amount) => look.post.flashColor(token, amount)
  });

  const resize = () => look.resize(innerWidth, innerHeight, Math.min(devicePixelRatio, 2));
  addEventListener("resize", resize); resize();
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const step = feel.step((now - last) / 1000); last = now;
    relic.rotation.y += step.simDt * 0.5;
    applyCameraFrame(camera, rig.update(step.presentationDt, { target: player.position, targets: [player.position, relic.position], aspect: innerWidth / innerHeight }), feel.shake.offset);
    look.update(step.presentationDt);
    look.render();
  });
  return { look, feel, rig, scene, camera, player };
}
`);
}

fs.writeFileSync(path.join(out, "index.html"), `<!doctype html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${gameName}</title>
  <style>
    html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#08090c}
    #game-canvas{display:block;width:100%;height:100%}
  </style>
</head>
<body>
  <div id="game"><canvas id="game-canvas"></canvas></div>
  <div id="ui"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>`);

const dependencies = { "@slu/web-shell": `github:${shellRepo}#v${shellVersion}` };
const devDependencies = { typescript: "^5.8.3", vite: "^7.0.0" };
if (renderer === "three") {
  dependencies.three = "^0.180.0";
  devDependencies["@types/three"] = "^0.180.0";
}

fs.writeFileSync(path.join(out, "package.json"), JSON.stringify({
  name: gameId,
  private: true,
  version: "0.1.0",
  type: "module",
  scripts: {
    dev: "vite",
    build: "vite build",
    check: "tsc --noEmit",
    verify: "npm run check && npm run build",
    "certify:web": "npm run verify && slu-certify web",
    "certify:mobile": "npm run verify && slu-certify mobile",
    "certify:controller": "npm run verify && slu-certify controller",
    "certify:release": "npm run verify && slu-certify release"
  },
  dependencies,
  devDependencies
}, null, 2));

fs.writeFileSync(path.join(out, "tsconfig.json"), JSON.stringify({
  compilerOptions: {
    target: "ES2022", module: "ES2022", moduleResolution: "Bundler",
    lib: ["ES2022","DOM","DOM.Iterable"], strict: true, skipLibCheck: true, ...(useLook ? { types: ["vite/client"] } : {})
  },
  include: useLook ? ["src/**/*.ts", "vite.config.ts"] : ["src/**/*.ts"]
}, null, 2));

fs.writeFileSync(path.join(out, "release-manifest.json"), JSON.stringify({
  gameId,
  version: "0.1.0",
  channel: "development",
  demo: false,
  renderer,
  frames,
  supportedInputs: ["keyboard-mouse", "gamepad"],
  supportedLocales: ["en"],
  requiredFeatures: []
}, null, 2));

const declarations = ["web-runtime", "controller-ui", "production-services", "release-manifest"];
fs.writeFileSync(path.join(out, "slu-certification.json"), JSON.stringify({
  schemaVersion: 1,
  requiredFiles: ["src/main.ts", "index.html"],
  requiredScripts: ["build", "check", "verify"],
  declarations,
  forbiddenSourceTokens: ["TODO_PLAYER", "PLACEHOLDER_PLAYER", "LOREM_IPSUM"],
  profiles: {
    web: { requiredDeclarations: ["web-runtime"] },
    controller: { requiredDeclarations: ["controller-ui"] },
    mobile: { requiredDeclarations: ["touch-gameplay"] },
    release: {
      requiredFiles: ["AGENTS.md", "CLAUDE.md", "release-manifest.json"],
      requiredDeclarations: ["web-runtime", "production-services", "release-manifest"],
      requiredJsonFields: {
        "release-manifest.json": ["gameId", "version", "channel", "renderer", "frames", "supportedInputs", "supportedLocales"]
      }
    }
  }
}, null, 2));

const sharedAgentsPath = path.join(shellRoot, "AGENTS.md");
const integrationContract = `

## Integration Contract

- Game code lives in \`src/game/**\` (plus generated scaffolding under \`src/\`). Shell code is never edited or copied in.
- Use shell services through public \`@slu/web-shell\` imports only (\`/look/three\`, \`/feel\`, \`/motion\`, …).
- Upgrading the shell means bumping the \`#vX.Y.Z\` tag in package.json and running \`npm run verify\`.
- Visual and feel tuning goes through tunables and \`tuning/*.json\` presets, never hard-coded magic numbers.
`;
if (fs.existsSync(sharedAgentsPath)) {
  fs.writeFileSync(path.join(out, "AGENTS.md"), fs.readFileSync(sharedAgentsPath, "utf8").trimEnd() + "\n" + integrationContract);
}
fs.writeFileSync(path.join(out, "CLAUDE.md"), "@AGENTS.md\n");
const sharedSkillsPath = path.join(shellRoot, "skills");
if (fs.existsSync(sharedSkillsPath)) {
  fs.cpSync(sharedSkillsPath, path.join(out, "skills"), { recursive: true });
}

fs.writeFileSync(path.join(out, "README.md"), `# ${gameName}

Generated by SLU Web Shell ${shellVersion}.

Renderer: ${renderer}
Frames: ${frames.join(", ")}

The game already boots through Title → Main Menu → Mode flow with keyboard/gamepad UI,
settings/pause/results screens, persistence, semantic input, studio telemetry/diagnostics,
production services, release metadata, and the reusable systems supplied by its Frames.

A release-manifest.json is generated alongside the project and release certification validates
its core identity and support metadata. Add ?dev=1 while developing to expose the shell dev console.
Certification profiles are available through npm run certify:web / mobile / controller / release.
Mobile certification intentionally fails until the game declares touch-gameplay after real touch gameplay support exists.

${renderer === "three" ? "Three.js games also include an image-to-procedural-visual registry and manifest under src/art/procedural/.\n\n" : ""}Replace starter renderer hooks and content selections with the game's actual Game DNA.
`);

console.log(`Created ${gameName} at ${out}`);
