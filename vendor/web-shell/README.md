# SLU Web Shell 1.3.0

**Layer 1 + Layer 2 for SLU browser games.**

This is the internal "engine above the engine": a renderer-neutral production shell, composable genre Frames, reusable game modules, controller-friendly UI shell, and project generator.

## Start a game

```bash
node tools/create-slu-game.mjs \
  --id airtime-next \
  --name "Airtime Next" \
  --renderer three \
  --frames arcade,vehicle
```

Renderer choices:

- `three`
- `babylon`
- `phaser`
- `canvas2d`
- `dom`

Frame choices:

- `arcade`
- `character-action`
- `arena-combat`
- `vehicle`
- `fps`
- `puzzle`
- `rpg`
- `strategy`
- `platformer`
- `party-multiplayer`

## What the generated game already has

Title → Main Menu → Mode Select → genre-relevant setup screens → gameplay handoff → Pause → Results.

Also: settings persistence, keyboard/gamepad UI navigation, save architecture, challenges, difficulty, stats, unlock/reward infrastructure and the reusable modules selected by its Frames.

## Architecture

```text
Game DNA
  ↓
Turnkey Frame Assemblies
  ↓
Reusable Modules
  ↓
SLU Web Shell
  ↓
Browser Platform
  ↓
Renderer Adapter
  ↓
Three / Babylon / Phaser / Canvas2D / DOM
```

See `docs/PRODUCTION-COMPLETE.md`.

## Look + Feel (Three.js)

`create-slu-game --renderer three` defaults to `--look slu`: Look Kit materials on the starter scene, post stack,
`tuning/` canon, the tuning panel in dev (`?tune`, backtick), `feel.impact` bundles and the frame's CameraRig
(platformer → 2D follow, character-action → spring arm, fps → first person, arena-combat → arena).
Lookdev Room: `npm run lookdev`. Details: `docs/LOOK-AND-FEEL.md`. Fill in `look/LOOK-BIBLE.md`.

## Install in a game

```json
"@slu/web-shell": "github:mikeylambo/Web-Game-Shell-v1.02#v1.2.0"
```

`dist/` is committed, so installs never build. Private-repo setup (local + Vercel): `docs/PRIVATE-REPO-INSTALLS.md`.

## Release gate

```bash
npm run verify
```

One command, all green or no release:

- version consistency (package.json = README header = CHANGELOG)
- strict TypeScript + runtime test suite
- git-tag install simulation (pack → clean install without build → import + typecheck every subpath)
- generated consumers for Three.js, Babylon.js, Phaser, Canvas2D, DOM and Pixi typecheck and release-certify
- headless Chrome flow (portrait + landscape)
- bundle budget

Cut a release with `npm run release -- minor` (verify, bump, CHANGELOG, commit, tag, push).
