# DECISIONS — Sticker Runners

Every assumption made while building, per CLAUDE.md ("unspecified + reversible + doesn't change feel → choose, continue, log").
**⚑ = touches feel. Mike should look at these first.**

## Phase 0 — 2026-11-08

### Setup / Shell
| # | Decision | Why | Reversible |
|---|---|---|---|
| 1 | Generated with `--frames arcade`, not `--frames title,menu,select,play,pause,results`. | Those names are screens, not Shell frames; the generator rejects them (`Unknown frame(s)`). `arcade` is the closest genre frame, and Title → Menu → Mode → play → Pause → Results all come from the Shell's default flow. | Yes |
| 2 | Shell dependency pinned to commit `7003ec7` (Web-Game-Shell-v1.02 `main`) instead of `#v1.3.0`. | The generator writes `#v1.3.0`, but no such tag exists on the repo, so `npm install` failed. The lockfile resolves it over `git+ssh`; a Vercel build will need the private-repo setup in the Shell's `docs/PRIVATE-REPO-INSTALLS.md`. | Yes, re-pin to the tag once it's cut |
| 3 | Shell capabilities turned off: stage, difficulty, character, vehicle and loadout select. | Phase 0 has a single ribbon. The Shell's default screens are otherwise unchanged. | Yes |
| 4 | Removed the generator's Look Kit starter scene (`src/look/startLookScene.ts`). | It creates its own WebGL renderer and demo scene on the same canvas. Phase 0 is "no art", so the game owns the renderer. | Yes |
| 5 | Tuning: `config/tuning.ts` defines schemas (with a `// why` on each value) and registers them with the Shell's `TunableRegistry`, and the Shell's backtick panel edits them live. Schema defaults are the source of truth; `tuning/<group>.json` only appears if someone presses Save in the panel, and then becomes canon. | Reuses the Shell panel instead of writing a new one. LOCKED values have their panel `min` pinned (`slapMomentumKeep` ≥ 0.90, `bufferFrames` = 5). | Yes |
| 6 | Stage data lives in `data/stages/phase0.ts`, not `.json`. | The track's elevation is a function, and type checking catches authoring mistakes. | Yes |
| 7 | Playwright isn't a devDependency. The smoke test resolves the machine's install and fails with instructions if it's missing. | The cloud sandbox ships its own Playwright and browser; adding one would install a second copy. | Yes |
| 8 | ESLint and Vitest were added as devDependencies. | `npm run gates` needs lint and unit tests, and the Shell provides neither. | Yes |

### Track & content
| # | Decision | Why |
|---|---|---|
| 9 | Track-space convention: +lateral = rail side (screen lower-right), −lateral = void (screen upper-left). Ribbon is ±3 m. Heading + = left turn. | Matches "gold rail on the lower/right edge, open void on the upper/left edge". |
| 10 | Ribbon: 2,000 m, a 250 m straight, then curves of 20–40° over 150–300 m each (radius ≥ 350 m), plus ±8 m rolling hills (≤ 2.9° slope). No banking. | "Straight into gentle curves". |
| 11 | 5 gaps of 14, 18, 24, 22 and 30 m. The longest (30 m) is clearable by a full peel at top speed (≈ 1.0 s of the 1.5 s adhesion). | 5 pre-placed gaps, each solvable without debris. |
| 12 | 10 debris islands, all on the void side (lateral −8 to −14, heights −3.2 to +0.3 m). I4 and I8 bridge gaps G3 and G5; I1→I2 and I5→I6 are chains; U1 sits low (−3.2 m) as the entry to the underside line. | 10 static slap targets, with some free lines to find. |
| 13 | ⚑ **Static blade row**: 7 full-width blades on top of the underside section (s 1310–1400). A hit costs 30% speed and gives 0.8 s of invulnerability. **No outline loss** (out of scope). | Gives the underside line a reason to exist and makes "ground hazards pass beneath" while peeled testable. GDD §16 allows one static hazard type per stage. Peeled = immune. |
| 14 | ⚑ **Underside section** (s 1295–1420): the road's underside is stickable there, marked with a teal underside and a dashed cyan void edge. **Exit = fold**: steering off the void edge while on the underside wraps you round onto the top face, keeping your speed, with an 8-frame steer grace so a held "left" doesn't immediately carry you off the top edge. | **New mechanic, not in the GDD.** Without it there's no way back up: gravity is "down" and the top face can't be targeted from below. Alternatives: underside ends in a ramp, or allow slapping the top face from beyond the edge. Easy to cut. |
| 15 | Finish = 20 m before the ribbon's end. On finish, Tack coasts for 1.0 s, then the Shell results screen shows the time, slaps, whiffs and falls. | The run needs an end so the Shell results/retry loop works. This isn't scoring. |

### Movement (sim) — ⚑ all feel
| # | Decision | Why |
|---|---|---|
| 16 | ⚑ **Peel = hover, not an arc.** Peel eases Tack to `peelHeight` 0.9 m off the face it left (time constant 0.035 s ≈ the GDD's 2f startup) and holds there while adhesion lasts. Gravity (6 m/s²) applies only once falling. | GDD §10: peel "must never feel like a jump". A ballistic arc under 6 m/s² that lasts 1.5 s would peak at 1.7 m, which reads as a jump. **Interpretation of GDD §9's "gravity toward the track plane 6 m/s²".** |
| 17 | 0.9 m peel height clears the 0.6 m blades. | GDD §11 hurtbox is about 0.9 m tall. |
| 18 | Adhesion running out while still held → you fall, but **releasing still attempts one slap**. After a whiff there are no more slaps until you're stuck again. | "When in doubt keep Tack stuck", and handoff step 6 says "whiff = keep falling". |
| 19 | You can peel only when stuck or in coyote. You can't peel while falling. | Pillar 1: no double jump. |
| 20 | Falling onto a top face auto-sticks ("land"): speed is kept, with a small ring and no hitstop. A fall into the upper half of a slab snaps up onto it; one into the lower half scrapes beneath. | Momentum is sacred; no clipping through slabs. |
| 21 | Coyote (6f) applies off every edge: the void edge, gap starts, island edges and the underside end. The rail side is solid (clamped). | GDD: coyote off the void edge; the guardrail side is solid. |
| 22 | Hitstop freezes the sim, **including the input buffers**, so presses made during hitstop are kept. | More forgiving; matches "full control immediately" (0f recovery). |
| 23 | ⚑ **Slap speed = entry × `slapMomentumKeep` (0.92)**, capped at `absCap`. Auto-run then re-accelerates to top speed. | The GDD's "no braking penalty on slap" is read as no penalty beyond the 0.92 keep. |
| 24 | ⚑ **Slap targeting** (`src/game/sim/Targeting.ts`): a surface counts only if Tack is on its facing side, within `slapRange` 8 m. Candidates: (a) the face straight along the normal (the one your shadow is on), which is **always valid, cone-exempt**; (b) where the aim ray meets the face; (c) the face points nearest the aim point and nearest Tack. The nearest valid candidate wins. | Without (a), hovering directly over an island while holding the stick toward it whiffs (it's 39° off a 35° cone). "Your shadow is on it" is a readable rule. |
| 25 | ⚑ **Aim axis** (track space) = normalize(forward 0.35, lateral = stick, vertical 0.45 toward the sheet). "Toward the sheet" means down when above the road's underside level and up when below it, which is how you aim up at the underside from the low island. | The GDD gives a 35° cone but no axis. The weights are tunable (`aimForward`, `aimVertical`). |
| 26 | Snap = 3 frames, **counting the release tick**. The target `s` is advanced by the distance travelled during the snap, so Tack never visibly snaps backwards. | Handoff step 6: "within 3f". |
| 27 | ⚑ **Kick-off** = +8 m/s per press, capped at 44, with a 0.35 s cooldown. Above top speed, speed **bleeds at 3 m/s²** while stuck. Stuck only. | The GDD says "burst toward 44" without specifying how. With no bleed, Kick-off becomes permanent 44 m/s after two taps. |
| 28 | Start: a 0.3 s press-on, then 0 → 32 m/s in 1.6 s. | GDD §9. |
| 29 | Fall-out: being more than 2.5 m below the sheet (or more than 40 m out laterally) for 1.0 s = fall-out. Respawn is on clean road 25 m before where the fall began, with a 1.0 s re-stick (Tack blinks), then 16 m/s. | Handoff step 8. "Off-screen" is expressed in sim terms so the sim never depends on the renderer. Respawning behind the gap means you retry it. |
| 30 | `?god`: gaps and the void edge are solid, and adhesion doesn't drain. | GDD §32. |

### Camera / presentation
| # | Decision | Why |
|---|---|---|
| 31 | ⚑ **Distance 110 m.** FOV 22°, pitch 38° and yaw 30° are exactly as specified. At 110 m, 64 m of road is visible ahead (**2.0 s at top speed**), and Tack sits about 36% from the left. **Conflict:** the GDD's calibration "road crosses the screen diagonal in ~1.2 s" needs about 55 m, which leaves only ~1.3 s of road ahead. I chose the sightline (GDD §16 "always", §15 camera priority #1). | Try `distance` ≈ 75 in the panel to feel the 1.2 s version. |
| 32 | The camera heading follows the track tangent (smoothed over 0.6 s), so curves keep the bottom-left → top-right diagonal. Lateral follow is 0.5. | "Fixed 3/4 diagonal", read as fixed relative to the track. |
| 33 | ⚑ **Tack is drawn 2.8 m tall** (about 47 px on a 720p screen). This is visual only; the hurtbox stays 0.6 m wide. | GDD §13: 48 px sprites. At the 2 s-sightline distance, a 0.9 m sprite would be about 15 px. |
| 34 | The sticker draws with **depth test off**: always visible, including under the road, where it's mirrored and dimmed 35% ("behind the sheet"). | Pillar 2, readability over realism. With depth on, the underside line would be invisible from this camera. |
| 35 | ⚑ **Peel curl = the spec'd vertex bend (gentle) plus a shader fold** that peels the bottom edge up and shows the ivory backing paper. Fold depth = curl, so it straightens as adhesion runs out. It flutters at ≤ 0.3 s left and snaps flat on slap. | In screenshots, the vertex bend alone just looked like a vertical squash at this camera pitch. This adds to the bend rather than replacing it. |
| 36 | Die-cut border: alpha dilation in the fragment shader. Thickness = `outline`/25 **screen px**, converted to UV each frame, plus a 1 px keyline. `outline` is fixed at 100 (4 px); the panel value previews thinner borders. | GDD §23 recipe. Outline loss is out of scope. |
| 37 | Contact shadow: a hard ellipse on whatever face lies straight along the normal. When peeled it stays on that face, softening and fading with height. It's hidden over the void. | Handoff step 5. |
| 38 | The Slap Ring is a flat die-cut ring (ivory band, dark keylines) stamped in the surface plane for 0.3 s. Smaller rings mark land, wrap and re-stick. | Handoff step 6, GDD §25. |
| 39 | Slap feel: 4f hitstop, 3 px shake for 6 frames, a 2-frame 1.2° zoom punch and a 0.28 squash. Shake scales with the Shell's Screen Shake setting. | GDD §10 and §15. |
| 40 | **Not built:** gloss band, wind lines, peel glint, bloom. | None is in the Phase 0 handoff list. |
| 41 | A controls hint appears for 7 s at the start of each run. | It tells the player what they can do (Shell constitution #8). |

### Input / audio / tools
| # | Decision | Why |
|---|---|---|
| 42 | ⚑ Keyboard steer: A, W, ← or ↑ = toward the void (screen upper-left); D, S, → or ↓ = toward the rail. Gamepad: stick right or down = rail side; D-pad works the same way; A = peel, X = kick-off. Deadzone is 0.2. Space and A double as the Shell's UI accept; the gameplay screen has no choices, so they don't conflict. | The ribbon is diagonal, so both key pairs map to "across the road". |
| 43 | SFX are all synthesized: peel "thhp" (band-passed noise sweeping down), slap (noise crack + low thump + click), whiff (resonant hollow sweep + falling tone), plus kick, land, wrap, hazard, fall-out and re-stick. Volume = `sfxVolume` × the Shell's master volume. Audio unlocks on the first key or click. | Handoff step 9. |
| 44 | URL flags: `?god`, `?slow=0.25`, `?tells` (draws surface/hazard rects, the live aim axis and the target a release would pick), `?quick`, plus `?step` (no rAF; advance with `__GAME.step(n)` / `__GAME.run(n)`) and `?bot` (autopilot). | GDD §32 and handoff step 10. |
| 45 | `window.__GAME`: `state`, `step(n, input?)`, `run(ticks)`, `place(s, lat, h, n)`, `setAutopilot`, `tunables`, `events()`. | Headless tests and capture. |
| 46 | Changing `ribbonWidth` in the panel only takes effect on Restart/Retry (the course is rebuilt). The blades stay ±3 m. | Rebuilding meshes every frame isn't worth it. |

## 2026-11-09 — Vendored the Web Shell for deploys
The Shell was a `github:` dependency on a private repo, so Vercel's `npm install` failed (SSH publickey denied). Its built package (dist, package.json, tools, README) from commit 7003ec7 now lives in `vendor/web-shell`, and package.json points at `file:vendor/web-shell`. ESLint ignores `vendor/**`. To update the Shell: rebuild it at the new commit and recopy those files. Gates pass.

## Phase 0b — 2026-11-09: Mac blank screen, touch, orientation

No sim tuning or feel values changed. The desktop smoke run is identical to before (same 52.617 s autopilot run).

### Mac blank screen
| # | Finding / decision | Status |
|---|---|---|
| 47 | **Suspected cause (not confirmed on Mike's Mac):** the WebGL context fails to create. Three r180 is WebGL2-only, and context creation can fail with GPU blocklisting, hardware acceleration off, or a dual-GPU Mac refusing `high-performance`. The `new Game()` constructor then throws after the Shell menus are built: the menus keep working, nothing listens for `level:loaded`, and selecting a mode shows the (CSS-hidden) gameplay screen, i.e. blank. The error only went to the console. **Reproduced exactly** with the old deployed build in Chromium with WebGL disabled: menus work, mode select → blank, console says `Error creating WebGL context.` | Mechanism reproduced. Mike's actual cause is unconfirmed; the overlay will name it. |
| 48 | Renderer creation now tries `high-performance` + antialias, then `default` without antialias, then `low-power`. The fallback used is reported on screen. If all three fail, the overlay says so and suggests turning on hardware acceleration. | Verified headless with WebGL disabled. |
| 49 | Error overlay: an inline classic script in `index.html` (it works even if the bundle fails to evaluate) catches `error` and `unhandledrejection`. The game reports shader compile/link failures (`renderer.debug.checkShaderErrors = true` + `onShaderError`), `webglcontextlost`/`restored`, and frame exceptions. Plain text, selectable, has a close button, ships in production. | Verified: no-WebGL, forced context loss, and an injected frame throw. |
| 50 | The rAF loop schedules the next frame **before** running this one, and catches errors. Previously one throw stopped the loop for good (a frozen or blank canvas). | Verified: the loop continued after an injected throw. |
| 51 | **Two owners of one drawing buffer, fixed.** The Shell's `createThreeStarterAdapter` now gets a detached canvas. The game sizes `#game-canvas` from its CSS box (`clientWidth/Height`) via a `ResizeObserver`, plus on window resize, on `start()`, and whenever the buffer is found at 0×0 before a frame. | Bug regardless of the Mac. Fixed. |
| 52 | Hi-DPI / ProMotion: pixel ratio is capped at 2. The fixed-60 Hz accumulator was driven at 120, 60 and 30 Hz for 5 s each: sim time 4.98–5.00 s every time (no stall, no spiral). Negative or huge frame intervals are clamped. | Verified headless. |
| 53 | Safari/WebKit audit: all GLSL goes through Three's ShaderMaterial prefixing (precision qualifiers added by Three). The shaders use `texture2D` (Three maps it for GLSL3), constant-bound loops, and no Chrome-only extensions. Top-level await needs Safari 15+, and Vite's default target is Safari 16. Nothing Chrome-only found. | **WebKit itself not run here**; only Chromium is installed in this sandbox. |
| 54 | `?diag` shows an on-screen line: fps, avg/p95 frame interval, dpr → render ratio, drawing-buffer size, orientation, which context attempt succeeded, GPU string. | For measuring real devices without a console. |

### Touch (one thumb) — ⚑ feel
| # | Decision | Why |
|---|---|---|
| 55 | ⚑ **Gesture window, 70 ms (~4 sim frames).** Each touch is classified as a flick (kick-off), a horizontal drag (steer-only) or a hold (peel) within this window. **Touch peel is therefore ~4 frames later than keyboard/pad peel.** Tunable `sr.touch.gestureWindowMs`; at 0 peel is instant, but flicks also peel. | The brief requires that a kick flick never peels, and that needs a decision window. |
| 56 | ⚑ **Steer while stuck = a touch that starts as a horizontal drag** (≥ 14 px inside the window). That touch steers and never peels; lift and touch again to peel. A held (peel) touch steers/aims with relative drag. Full steer = 48 CSS px of drag from the touch-down point, with a 4 px deadzone. | "Hold anywhere = peel" plus "drag = steer while stuck" conflict for one finger. Resolved by how the touch starts. |
| 57 | Kick flick = ≥ 24 px up, more vertical than horizontal (1.5×), within 180 ms. | Distance/time thresholds per the brief. |
| 58 | A tap released inside the window = a peel-tap (peel one tick, then slap), like tapping Space. A second finger is ignored (reserved for Patch). | |
| 59 | Pause: a 52 px button, top-right, offset by safe-area insets, shown only while playing on a touch UI. The Shell pause/results/retry screens are tapped directly (they're buttons). | |
| 60 | No scroll, zoom, long-press or selection: `touch-action:none`, `user-select:none`, `-webkit-touch-callout:none`, viewport `maximum-scale=1,user-scalable=no`, plus `touchmove`/`gesturestart`/`contextmenu` preventDefault (except inside the error overlay, Shell panels and the tuning panel). The Shell viewport policy runs without safe-area padding so the canvas goes full-bleed. | |
| 61 | Audio unlock on the first `pointerdown` and on `touchend` (iOS). | Not verified by ear. |
| 62 | Touch hint: "HOLD PEEL · LET GO SLAP / DRAG STEER · FLICK UP KICK-OFF", shown on coarse-pointer devices or after the first touch. In portrait it sits at the top (Tack rides the lower third). | |

### Orientation A/B
| # | Decision | Measured (headless Chromium, emulated devices, Tack at 32 m/s) |
|---|---|---|
| 63 | `?orient=landscape|portrait`, default `auto` (portrait if the viewport is taller than wide). Live toggle: `sr.camera.orient` in the backtick panel. | |
| 64 | **Landscape = the Phase 0 camera, unchanged** (FOV 22°, pitch 38°, yaw 30°, distance 110, lead base 4). | iPhone 13 landscape (750×342): 2.47 s of road ahead; **Tack ≈ 25 CSS px tall** (the same share of screen height as on desktop, but under the 48 px readability target). |
| 65 | ⚑ **Portrait:** yaw 90° (camera behind Tack, ribbon runs bottom → top, rail on the right), pitch 38° (unchanged), **FOV 30°, distance 85 m, lead base 10 m**. The GDD's 22° FOV is a landscape number: at 22° portrait showed only 1.72 s ahead, and pushing Tack lower to compensate put it under the thumb. | iPhone 13 (390×664): **2.19 s ahead, Tack 52 CSS px**, 81% down the screen. Pixel 7 (412×839): 2.19 s, 65 px. iPhone SE (320×568): 2.19 s, **44 px** (below 48). |
| 66 | Forcing `?orient=landscape` on a phone held upright frames badly (0.9 s ahead, Tack at the left edge). For the landscape A/B, hold the phone sideways. | |

### Mobile performance
| # | Decision | Status |
|---|---|---|
| 67 | Pixel ratio capped at `sr.render.maxPixelRatio` = 2. Antialias is off on coarse-pointer devices with dpr ≥ 2 (MSAA is redundant at that density). | |
| 68 | Adaptive resolution: if the average frame interval stays above 19 ms for 2 s, the pixel ratio drops by 0.25, never below 1. Presentation only. | |
| 69 | **Real-device frame time is unmeasured.** No phone was available to this build. `?diag` reports it. | Unmeasured |

### Gates
| # | Decision |
|---|---|
| 70 | `npm run smoke` now runs the desktop smoke **and** `tools/touch-e2e.mjs`: an emulated iPhone 13 in portrait and landscape, Shell flow by tap only, pause button, hold → drag → release over gap 1 (slap ≥ 90% asserted), flick = kick (no peel), drag = steer (no peel), finish → results → tap Retry. Touches are real CDP touch events → pointer events (`pointerType: "touch"`). Emulated on Chromium, not WebKit/iOS Safari. |

## Phase 0c — 2026-11-10: the "web" test (`?stage=web`)

The question: does peel → slap feel good when the world is dense with surfaces? **No new verbs, and no peel/slap tuning changed.** The Phase 0 ribbon is unchanged: same autopilot result (52.617 s, 12 slaps), and all earlier tests pass. The vision note referenced in the brief was not attached to the session; this build follows the prompt only.

### Where it lives
| # | Decision | Why |
|---|---|---|
| 71 | The web section is a separate stage behind `?stage=web`, not appended to the ribbon. | Keeps the Phase 0 ribbon (and its gates) untouched; Mike can A/B by URL. `?stage=web&quick` skips menus. |
| 72 | 810 m track, mostly straight with one gentle 10° bend; finish at 710 m. Lines take ~18–24 s. | "~20 s section". |

### Sim generalisation (same rules, more surface types) — ⚑ feel-adjacent
| # | Decision | Why |
|---|---|---|
| 73 | Surfaces have a **face axis**. Floors/undersides keep the old maths (face ⟂ height). **Walls** have their face ⟂ lateral, spanning a height range. Targeting, stick, peel, coyote and the stuck invariant all work per axis. For floors the code paths are identical to before (verified: ribbon results unchanged). | Brief item 3 needs a vertical surface you can ride. |
| 74 | ⚑ **On a wall, steer moves Tack up/down the wall** (screen-up keys / drag left = climb; right/down = descend). Auto-run continues along the track. **Peeling off a wall lifts 0.9 m away from it laterally** (the same hover, rotated). Steer still moves height while peeled. | Same rule as floors: peel lifts along the face normal; steer moves the in-plane cross axis. |
| 75 | ⚑ **You leave a wall by sliding off an edge** (bottom, top or its end) while peeled. Releasing while still over the wall re-slaps the wall: the existing "the surface your shadow is on is always a valid, nearest target" rule, now applied along the wall's normal. | No new rule. It does make walls "ride, slide off, slap". |
| 76 | The "your shadow surface" slap candidate only looks along the face axis Tack is on/peeled from (floors → height, walls → lateral). | Otherwise a wall 6 m to the side would count as "beneath" a floor rider. |
| 77 | **Moving platforms** move sideways or up/down as a sine of **sim time** (deterministic). A stuck Tack is carried by the platform's motion each tick. The renderer poses the same platforms from the same time. | Brief item 2, without breaking determinism. |
| 78 | Blades now sit on any strand (each has a face height). They apply to stuck riders on the top face of road/strands only, so riding a strand's underside skips them. | Brief item 4: ride the underside to stay fast. |
| 79 | Respawn in the web stage: the widest static strand containing the respawn point, centred, clean for 12 m. | There is no "road" there. |
| 80 | The camera follows 60% of Tack's height in the web stage only (`cameraHeightFollow`). It's 0 on the ribbon (unchanged). | Strands span h −3…+7; without it the high and low layers drift off-frame. |

### Layout — two lines (brief item 6)
| # | Decision | Why |
|---|---|---|
| 81 | **The web runs downhill.** Peel hovers 0.9 m and never climbs, so a slap can reach a surface at most ~0.85 m *above* you. Height is gained only by riding the wall or a moving platform. | Pillar 1 (no jump) shapes the level. |
| 82 | **Safe line:** wide railed strands A (h 3) → B (1.5) → C (0) → D (−2, finish). 3 transfers. Each of A, B and C carries a blade field (blades every 10 m): hop them (peel/slap) or eat them (−30% speed each). | "Safe" = can't fall off (rails, wide), but slow. |
| 83 | **Fast line:** A → F1 (void-side strand) → **wall** (ride it down) → **P1** (slides sideways) → **B's underside** (under B's blade field) → F3 (rail-side strand) → **P2** (lifts up/down) → D. 7 transfers, all clean surfaces, so kick-off stays usable. | Uses every element the brief asked for. |
| 84 | Measured with the line bots (pure sim): **safe 23.6 s, fast 18.1 s → fast is 23% quicker**, with 7 transfers vs 3. In the browser (with the 1 s finish coast): 24.6 s vs 19.2 s, 22%. Both lines: zero falls, every slap 92% kept. | Brief: fast ≥ 15% quicker with more transfers. Gated. |
| 85 | The speed gap comes from **blades and kick-off availability**, not path length (both lines cover the same track distance). The safe line spends its blade fields peel-hopping (no kick-off while peeled, 4%/s decay, 92% per slap); the fast line's clean strands let kick-off hold ~40 m/s. | It's the only honest lever with no new mechanics or tuning: the slap/peel rules make transfers nearly free in speed, so avoiding blades is the win. |

### Density (brief item 5)
| # | Decision | Why |
|---|---|---|
| 86 | "≥ 2 valid slap targets within one peel" is checked by a **probe that runs the real sim on throwaway clones**: from the standing point, peel now, hold steer ∈ {−1, −½, 0, ½, 1}, release after 3…90 ticks (the 1.5 s adhesion), and record which surface each slap lands on. **The surface you're standing on doesn't count**; it needs ≥ 2 *other* surfaces. | A literal, mechanical reading of "reachable within one peel". |
| 87 | Gate: every standable surface sampled every 8 m (centre plus both edges on wide strands; three heights on the wall), at **two moving-platform phases**: 1,470 probes, all ≥ 2. | `tests/web.test.ts`. |
| 88 | To get there: generated flanking lanes at lateral ±7 and ±14 (≈45 m segments, short gaps, each sits 0.4/0.6 m below the centre strand so neighbours can reach each other), a low layer under B (U0/U1/U2), floors beside the wall (W1/W2/W5) plus a high ledge (H1), and a few far platforms near the finish. Total ~70 surfaces. | The probe found 237/475 weak points on the first layout. The biggest culprit was "nearest valid target wins": a close surface shadows a farther one. |
| 89 | `?tells` in the web stage puts a cyan marker on every other surface the probe can reach from where Tack stands (refreshed ~5×/s while stuck), alongside the existing aim line and picked-target marker. | Brief: "show them with ?tells". |

### Presentation
| # | Decision |
|---|---|
| 90 | Each strand/platform is one flat mid-value colour, with darker sides and a lighter lip on void edges. Stickable undersides get a cyan-tinted band. The wall is a solid purple face. Blades stay red (no white). Tack's ivory border remains the lightest thing on screen. |
| 91 | Bots: `?bot` on the web stage plays the safe line, `?bot&line=fast` the fast one (`src/game/sim/WebBot.ts`: steers to the next surface, peels at the leave point, and releases when the sim's own slap preview *is* the next surface). |
