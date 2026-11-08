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

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const rendererAdapter = createThreeStarterAdapter(canvas);
const flags = readFlags();

bootProceduralVisualManifest();

const app = await createGameApp({
  gameId: "sticker-runners",
  gameName: "Sticker Runners",
  version: "0.1.0",
  renderer: rendererAdapter,
  root: document.getElementById("ui")!,
  // Phase 0: one ribbon, no stage/difficulty pickers (Shell default screens otherwise).
  capabilities: { stageSelect: false, difficulty: false, characterSelect: false, vehicleSelect: false, loadout: false },
  assemblies: [
    (shell) => createArcadeAssembly({ shell })
  ]
});

const game = new Game(canvas, flags, {
  shakeScale: () => Number(app.settings.snapshot().screenShake ?? 1),
  masterVolume: () => Number(app.settings.snapshot().masterVolume ?? 1),
  onFinish: (r) => {
    app.ui.updateScreen("results", {
      subtitle: `${r.time.toFixed(2)} s · ${r.slaps} slaps · ${r.whiffs} whiffs · ${r.falls} falls`
    });
    app.flow.showResults();
  }
});

const shell = app.shell;
shell.events.on("level:loaded", () => game.start());
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
