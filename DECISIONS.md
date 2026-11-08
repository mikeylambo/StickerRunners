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
