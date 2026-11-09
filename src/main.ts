import { bootProceduralVisualManifest } from "./art/procedural/visualManifest";
import {
  createGameApp,
  createArcadeAssembly,
  createThreeStarterAdapter,
  mountBrowserDevConsole
} from "@slu/web-shell";
import { Game } from "./game/Game";
import { readFlags } from "./game/flags";
import { installDevTools } from "./game/dev/DevTools";
import { installDiagnostics } from "./game/dev/Diagnostics";
import { report } from "./game/dev/report";
import { tunables } from "@slu/web-shell/tuning";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
// The Shell's starter adapter resizes whatever canvas it is given. The game owns #game-canvas
// (one owner per drawing buffer), so the adapter gets a detached canvas it can resize harmlessly.
const rendererAdapter = createThreeStarterAdapter(document.createElement("canvas"));
const flags = readFlags();
if (flags.orient !== "auto") tunables.set("sr.camera", "orient", flags.orient);

bootProceduralVisualManifest();

const app = await createGameApp({
  gameId: "sticker-runners",
  gameName: "Sticker Runners",
  version: "0.1.0",
  renderer: rendererAdapter,
  root: document.getElementById("ui")!,
  // Phase 0: one ribbon, no stage/difficulty pickers (Shell default screens otherwise).
  capabilities: { stageSelect: false, difficulty: false, characterSelect: false, vehicleSelect: false, loadout: false },
  // Full-bleed canvas behind the notch; the pause button and hint pad themselves with safe-area insets.
  mobileViewport: { includeSafeAreaPadding: false, background: "#05030c" },
  assemblies: [
    (shell) => createArcadeAssembly({ shell })
  ]
});

let created: Game;
try {
  created = new Game(canvas, flags, {
    shakeScale: () => Number(app.settings.snapshot().screenShake ?? 1),
    masterVolume: () => Number(app.settings.snapshot().masterVolume ?? 1),
    onFinish: (r) => {
      app.ui.updateScreen("results", {
        subtitle: `${r.time.toFixed(2)} s · ${r.slaps} slaps · ${r.whiffs} whiffs · ${r.falls} falls`
      });
      app.flow.showResults();
    }
  });
} catch (e) {
  // Without this, a failed WebGL init leaves the Shell menus working but gameplay blank: a suspected cause
  // of the Phase 0 Mac blank screen (unconfirmed — see DECISIONS.md).
  report("Game failed to start", e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e));
  throw e;
}
const game = created;

const shell = app.shell;
shell.events.on("level:loaded", () => game.start());

// Touch pause button (top corner, safe-area aware). Hidden unless playing on a touch device.
document.getElementById("sr-pause")?.addEventListener("click", (e) => {
  e.preventDefault();
  if (shell.session.phase === "playing" && !game.paused) app.flow.showPause();
});
if (flags.diag) installDiagnostics(game);
shell.events.on("game:restart", () => game.start());
shell.events.on("game:pause", () => game.setPaused(true));
shell.events.on("game:resume", () => game.setPaused(false));
shell.events.on("game:quit", () => game.stop());

installDevTools(game);

if (flags.quick) {
  // ?quick: skip title/menu straight into the ribbon
  app.flow.onActivate("title", "start");
  app.flow.onActivate("main-menu", "play");
  app.flow.onActivate("mode-select", shell.modes.list()[0]?.id ?? "default");
}

if (new URLSearchParams(location.search).get("dev") === "1") {
  mountBrowserDevConsole(app.shell.studio.dev, { title: "Sticker Runners DEV" });
}
