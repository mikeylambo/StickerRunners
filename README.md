# Sticker Runners: Phase 0 (Thesis Proof)

Greybox to answer one question: **does peeling off a speeding road and slapping onto a new surface, without losing momentum, feel unlike anything else?**
Design: `docs/GDD.md` · Law: `CLAUDE.md` · Every assumption: `DECISIONS.md` · Shell constitution: `AGENTS.md`

## Run
```bash
npm install
npm run dev          # http://localhost:5173  (add ?quick to skip the menus)
npm run gates        # typecheck · lint · unit + sim invariants · headless E2E (desktop + touch portrait/landscape)
```

## Controls
| | Keyboard | Gamepad |
|---|---|---|
| Steer / aim (across the ribbon) | A/D, or W/S, or arrows | Left stick / D-pad |
| Peel (hold) → Slap (release) | Space | A |
| Kick-off (while stuck) | Shift | X |
| Pause | Esc | Start |
| Tuning panel | ` (backtick) | |

**Touch (one thumb):** hold anywhere = peel, let go = slap, drag sideways while holding = steer/aim, start a touch with a sideways drag = steer while stuck (no peel), quick flick up = kick-off, ⏸ top-right = pause. Every menu is tappable.

## What's in the ribbon (2,000 m)
- 5 gaps: peel over them.
- 10 debris islands in the void (upper-left): slap onto them for lines. I4 and I8 bridge gaps; I1→I2 and I5→I6 chain.
- Underside line (~1,270–1,420 m): drop onto the low island U1, peel, steer under the road, release to slap **up** onto the teal underside, ride beneath the red blade row, then steer off the dashed cyan edge to fold back on top.
- Fall 1.0 s off the sheet → respawn on the road after a 1.0 s re-stick.

## Phase 0c web test
`?stage=web` — ~20 s of dense, flat-coloured strands, moving platforms, a rideable wall and an underside line. Safe line: stay on the wide railed centre strands and hop the blades. Fast line: F1 (left) → wall → sliding platform → under B → F3 (right) → lift platform → finish. Add `&tells` to see every surface reachable within one peel; `&bot` / `&bot&line=fast` to watch either line.

## Flags
`?orient=landscape|portrait` camera A/B (default follows the device; also `sr.camera.orient` in the panel) · `?diag` on-screen fps/frame-time/GPU line · `?quick` skip menus · `?god` gaps/edge solid, no adhesion drain · `?slow=0.25` · `?tells` surface rects + live slap aim/target · `?bot` autopilot (`&line=fast` on the web stage) · `?stage=web` · `?step` manual stepping via `window.__GAME.step(n)`

## Layout
`config/tuning.ts` all tuning (live via Shell tunables) · `data/stages/phase0.ts` the ribbon · `src/game/sim/*` fixed-60 Hz track-space sim (no Three.js) · `src/game/render/*` presentation · `src/game/audio/Sfx.ts` synthesized SFX · `tests/*` gates · `tools/smoke-e2e.mjs` headless E2E · `docs/evidence/` capture from a verified build.
