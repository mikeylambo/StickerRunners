# STICKER RUNNERS (working title)
## Game Design & Build Handoff Document

**Version:** 0.2
**Status:** Preproduction (Phase 0-ready)
**Last Updated:** 2026-11-04
**Primary Platform:** Web (desktop Chrome/Safari/Firefox), gamepad-first; Steam wrapper post-v1
**Engine / Stack:** Web Shell, TypeScript, Three.js renderer
✚ **Base Repo:** Shell-generated from `mikeylambo/Web-Game-Shell-v1.02`
✚ **Universe:** Standalone (an SLU skin can be decided later; no SLU names are used in v1)
✚ **Pipeline Triage Score:** __ / 30 (Mike to score against `TRIAGE.md`; estimated high on Identity and Scope, unproven on Feel)

**Purpose:** This document is the source of truth for STICKER RUNNERS's intended player experience, systems, content, presentation and completion criteria. If implementation details conflict with the intended player experience, preserve the player experience unless a documented technical constraint prevents it.

---

## 0. Executive Summary

### One-Sentence Pitch
A high-speed rival-duel racer where you play a living sticker on a ribbon highway in space: you peel off the road to dodge, slap onto anything to steal momentum, and spend your own outline to rebuild the road your rival is cutting apart.

✚ **Tagline:** PEEL. SLAP. DON'T FALL OFF.

### Player Fantasy
The player should feel like **an untouchable little decal of pure nerve**: tiny against an enormous cosmos, out-thinking a bigger rival by treating every surface (including the rival) as something to stick to.

### Core Experience
1. Keeping speed through peel → slap surface transfers.
2. Reading and surviving a rival who attacks the road, not you.
3. Spending yourself (your outline) to stay alive and on route.

The player spends most of their time **running the ribbon at speed and deciding when to leave it.**

### ✚ The Bet
> *Does peeling off a speeding road and slapping onto a new surface, without losing momentum, feel unlike anything else?*

Phase 0 exists only to answer this question.

### ✚ Competitive Position
| | Closest existing game | How we differ |
|---|---|---|
| Verb | Sonic (boost/grind), Distance (fly/stick) | Two-state adhesion: peel (off) / slap (on any surface, including the rival) with full momentum carry |
| Payoff | Time-trial PB | Out-maneuvering a rival who reshapes the track in real time |
| Space / structure | Linear racer or boss rush | A locked-diagonal ribbon over a void, duel by duel; the track itself is the battlefield and a resource |

### Target Experience
- **Session length:** 10–30 min (duel = 60–120 s; retries are instant)
- **Players:** 1 (v1). Local 1v1 versus is "Should Ship."
- **Perspective:** Fixed 3/4 diagonal, near-orthographic, track runs bottom-left → top-right
- **Genre:** Arcade action racer / boss rush
- **Audience:** Midcore to hardcore movement players, speedrunners, Sonic/Celeste/Neon White fans
- **Complexity:** Midcore floor, hardcore ceiling
- **Primary input:** Gamepad (keyboard fully supported)

---

## 1. Design Pillars

### Pillar 1 — Stick or Fall
- **Meaning:** Adhesion is the core physics. You are always either stuck to something or peeled and falling.
- **Player consequence:** Every second is a choice between grip and freedom.
- **Reject features that:** add a third, "free-flight" state, a double jump, or any movement that doesn't route through peel/slap.

### Pillar 2 — The Sticker Is the HUD
- **Meaning:** The die-cut outline, peel curl and contact shadow carry all player-state information.
- **Player consequence:** Players read their health, adhesion and grounded state off the sprite, not a bar.
- **Reject features that:** add health bars, floating numbers, or UI that duplicates sprite information.

### Pillar 3 — Momentum Is Sacred
- **Meaning:** Speed is never silently deleted. Peel and slap conserve it; only the player's mistakes or the rival's attacks cost it.
- **Player consequence:** Skill expresses as sustained speed and clever transfers.
- **Reject features that:** hard-stop the player on transitions, or slow the game with animation locks.

### Pillar 4 — The Road Is the Fight
- **Meaning:** The rival attacks the track, and the player's main counterplay is surviving or repairing it.
- **Player consequence:** Duels are about geometry and routing, not trading hits.
- **Reject features that:** turn duels into HP races, or give the player a damage-dealing combo system.

### ✚ Design Laws
1. **Momentum in = momentum out.** A slap preserves at least 90% of entry speed, always.
2. **Every road attack is telegraphed** at least 0.6 s ahead, by shape on the track itself.
3. **One sprite, one angle.** Characters are drawn only at the 3/4 diagonal; no turnaround sheets.
4. **The outline is the only health.** If it isn't visible on the sticker, it doesn't exist.
5. **Verified, not reported.** A feature exists when it's proven in a running build.

---

## 2. Anti-Pillars
The game should not become:
- a combo fighter (no damage strings on the rival)
- a free-roam isometric platformer (the ribbon's narrowness is the drama)
- an endless runner with meta-grind
- unreadable at speed (no screen clutter over the lane)
- dependent on memorizing hidden rival patterns that have no visible tell
- a Sonic fangame in look or name (no blue hedgehogs, rings, or SEGA-adjacent iconography)

---

## 3. Reference DNA

| Reference | Take | Do Not Take |
|---|---|---|
| nandoo.px Stardust Speedway fan art | The locked diagonal, the tiny sticker sprites vs. a huge cosmos, the grounded-vs-hovering rival composition | Any Sonic character, rings, HUD or level identity |
| Sonic CD (Metal Sonic race) | The duel-as-race structure; a rival who is faster in a straight line | Side-scrolling camera; scripted chases |
| Distance / Trackmania | Momentum conservation; instant retry; route mastery | Car physics; free 3D camera |
| Celeste | Generous input buffering; readable failure; tight duel-length challenges | Precision-platform room grid |
| Punch-Out!! | Rivals as personality-driven pattern puzzles with clear tells | HP-based slugfest |
| Die-cut vinyl stickers / Stickerbomb culture | Border, gloss, peel curl, adhesive residue | Realistic paper physics simulation |

### Reference Weighting
- Duel structure (Sonic CD / Punch-Out!!): 25%
- Movement feel (Distance / Celeste): 30%
- Original sticker-adhesion direction: 45%

### ✚ Calibration Data
- Target the **feel** of Sonic Mania top running speed relative to screen width: the road should cross the screen diagonal in about 1.2 s at top speed.
- Celeste-style buffer of 5f for all actions and coyote time of 6f off a road edge.
- Deliberate deviation: no braking penalty on slap (unlike Distance's landing penalty); we reward commitment.

---

## 4. Core Loop

### Moment-to-Moment Loop (5–15 s)
Run the ribbon → spot the rival's telegraph on the track → **peel** over the hazard or gap → **slap** onto debris, the road's underside, or the rival → carry the speed back onto the road → grind the rail to restore outline → repeat.

### Match (Duel) Loop
1. Intro: rival and stage shown (2 s, skippable).
2. Race begins; the rival hovers in the void ahead or beside you and starts cutting the road.
3. Survive three escalating rival **phases**, each introducing one new road attack.
4. Reach the **Finish Gate** before the rival, or end within striking distance and **Slap-Finish** the rival (slap onto them during their exposed final phase).
5. Results: time, outline remaining, style grade; instant retry.

### Session Loop
Pick a rival → duel → fail fast or win → chase a better grade or the next rival.

### Long-Term Loop
Beat all 6 rivals → unlock Rival Remix (harder patterns) and Time Attack → chase S-grades and leaderboards. No stat upgrades.

### ✚ Fiction ↔ Mechanics Map
| Mechanic / Mode | Fiction meaning |
|---|---|
| Outline = health | A sticker's die-cut border is what holds it together; fray it away and it tears |
| Peel | Lifting off the surface like a decal |
| Slap | Re-adhering; stickers stick to anything |
| Rail grind restores outline | Friction against the gold guardrail re-seals your edge |
| Road patch costs outline | You literally tape the road back together with yourself |
| Rival cuts the road | Rivals are "Cutters": craft-knife spirits that want the highway for themselves |
| Falling into the void | Lost behind the sheet, off the page |

---

## 5. Player Goals
- **Immediate:** Stay on the ribbon, stay fast, dodge the next cut.
- **Duel goal:** Beat the rival to the Finish Gate or Slap-Finish them.
- **Secondary:** Finish with more outline, chain transfers for style, find faster lines.
- **Long-term:** Defeat all six Cutters; earn S-grades; top the leaderboards.

---

## 6. Game Rules
- **Win:** Cross the Finish Gate before the rival, **or** land a Slap-Finish during the rival's Exposed state.
- **Loss:** Outline reaches 0 and you take one more hit (Tear), **or** you fall into the void with 0 outline, **or** the rival crosses the gate first.
- **Falling with outline remaining:** you respawn on the road after a 1.0 s re-stick, losing 25 outline.

### Scoring (Style Grade)
| Action | Result |
|---|---|
| Clean transfer (peel → slap, ≥90% speed kept) | +100 |
| Rival slap (ride the rival) | +250 |
| Near-miss (hazard passes within 0.1 m under peel) | +50 |
| Road patch | +75 |
| Finish margin | +10 per 0.1 s ahead |
| Grade | S ≥ 6000 · A ≥ 4000 · B ≥ 2500 · C otherwise |

✚ **Rule budget:** 3 rules (stay stuck, outline is life, beat the rival) and 4 buttons (Peel, Slap-aim/Dash, Patch, Grind is automatic on rail contact).

---

## 7. Player Verbs

| Verb | Input | Function | Commitment | Major Interaction |
|---|---|---|---|---|
| Run / steer | Left stick / WASD | Lateral lane position on the ribbon | Low | Rail contact = grind |
| Peel | Hold A / Space | Lift off; immune to ground hazards; glide; adhesion drains | Medium | Void travel, dodging cuts |
| Slap | Release Peel | Snap to nearest valid surface in the aim cone; conserves momentum | High | Debris, road underside, rival |
| Kick-off | Press X / Shift while stuck | Burst forward along current surface (Dash); +speed | Low-Med | Rival riding, speed maintenance |
| Patch | Press Y / E | Spend 15 outline to lay a sticker-strip over a cut gap ahead | Medium | Rival road attacks |
| Grind | Automatic on rail contact | Restores outline; slight speed gain | Low | Rail |

---

## 8. Controls

### Gamepad
| Input | Context | Action |
|---|---|---|
| Left stick | Always | Steer / aim slap cone |
| A (hold) | Stuck | Peel |
| A (release) | Peeled | Slap toward the aim cone |
| X | Stuck | Kick-off |
| Y | Stuck or peeled | Patch the next gap |
| Start | Any | Pause |

### Keyboard / Mouse
| Input | Action |
|---|---|
| WASD | Steer / aim |
| Space (hold/release) | Peel / Slap |
| Shift | Kick-off |
| E | Patch |
| Esc | Pause |

**Hand split:** left thumb handles routing; right thumb handles adhesion decisions.

### Input Philosophy
- **Buffering:** 5f for all actions.
- **Simultaneous inputs:** Patch has priority over Kick-off on the same frame.
- **Held inputs:** Peel is hold-to-stay-peeled; release = slap.
- **Repeated inputs:** none rapid-fire; no mash mechanics.
- **Remapping:** full.
- **Analog thresholds:** 0.2 deadzone; aim cone snaps to the nearest valid target within 35°.
- **Controller disconnect:** auto-pause.
- **Input during transitions:** 6 guard frames after any menu opens.
- **Pause:** full sim freeze; available anytime except the 0.5 s results transition.

---

## 9. Movement Specification
Units are metres in track space (ribbon width = 6 m). Sim at a fixed 60 Hz.

### Base Movement
- **Top run speed:** 32 m/s; **Kick-off cap:** 44 m/s; **absolute cap:** 55 m/s
- **Acceleration:** 0 → 32 m/s in 1.6 s
- **Deceleration (no input):** none; speed holds (auto-run)
- **Lateral steer:** 9 m/s, 0.08 s to full
- **Peel glide:** forward speed decays 4%/s; gravity toward the track plane 6 m/s²; lateral control 70%
- **Momentum:** slap preserves ≥90% of entry speed (LAW)

### Movement Feel
- **Should feel:** slippery-fast but under control; peel is a breath, slap is a punch.
- **Should not feel:** floaty, sticky-slow, or like a car.

### Key Behaviors
- **Start:** a 0.3 s "press-on" stick animation at the line.
- **Stop:** not possible (auto-run). Kick-off cancels to a grind on rails.
- **Turning sharply:** steer is lateral only; the track's curves handle direction.
- **Obstacles:** a hit on a road obstacle while stuck costs 20 outline and 30% speed.
- **Ledges / edges:** coyote time of 6f off the void edge; the guardrail side is solid.
- **Falling:** peeled with 0 adhesion → fall; 1.0 s off-screen = fall-out.
- **Character collision:** slapping onto the rival = ride (see §11).

---

## 10. Game Feel Bible

### Peel
- **Fantasy:** a decal lifting off glass.
- **Startup:** 2f; the sprite's bottom edge curls up with a vertex bend, and the contact shadow detaches.
- **Active:** hazards pass under the shadow; a whoosh opens up and wind lines appear.
- **Impact:** a soft "thhp" vinyl sound; a 1-px white glint runs along the peeled edge.
- **Recovery:** none; peel is a state.
- **Success should feel:** like weightless cleverness.
- **Must never feel:** like a jump.

### Slap
- **Fantasy:** a sticker smacked onto a surface hard enough to sting.
- **Startup:** 3f snap-travel toward the target.
- **Impact:** hitstop of 4f, a 3-px shake, a radial "flattened air" ring, and a punchy SLAP sound.
- **Recovery:** 0f; full control immediately.
- **Success should feel:** like owning the surface. **Failure** (no target in the cone) should feel like a whiff into the void, with a hollow sound.

### Rival Slap (ride)
- **Fantasy:** you've hijacked the boss.
- **Impact:** hitstop of 8f, a big shake, and the rival flinches. You inherit their speed + 10%.

### Patch
- **Fantasy:** taping the road back together with yourself.
- **Feedback:** a strip of your outline unspools forward and seals the gap; your border visibly thins.

### Tear (loss)
- **Fantasy:** a sticker ripping. A 2-frame white-inversion flash, the sprite splits along a crease, and the halves flutter into the void.

### ✚ Impact Scale
Hitstop = 2f + speed(m/s) × 0.1, capped at 10f. Shake only on Slap tier and above, capped at 6 px.

| Event tier | Hitstop | Shake | Flash | Audio | Haptic |
|---|---|---|---|---|---|
| Light (near-miss, grind tick) | 0 | 0 | edge glint | tick | 20 ms low |
| Slap | 4f | 3 px | ring | SLAP | 60 ms mid |
| Heavy (rival slap, hit taken) | 8f | 5 px | border flash | crunch | 120 ms high |
| Climax (Slap-Finish, Tear) | 10f | 6 px | inversion | stinger | 250 ms pattern |

---

## 11. Combat / Interaction Model

### Core Relationship
**Read telegraph → choose route (peel / patch / rail) → transfer → punish the rival when Exposed.**

### ✚ Counter Matrix
| Option | Beats | Loses to |
|---|---|---|
| Peel | Ground cuts, road buckles | Air sweeps (high hitboxes), long gaps |
| Patch | Long gaps | Buckles (patch can't flatten a raised section), outline starvation |
| Rail grind | Lateral tilt attacks | Rail cuts |
| Rival slap | Air sweeps (you're on the rival) | Rival shake-off (telegraphed) |

### ✚ Tell Table (base attack set; each rival recombines these)
| Road attack | Windup | Visual tell (shape/motion) | Audio tell | Counterplay |
|---|---|---|---|---|
| Cut (gap) | 0.8 s | Dashed scissor-line drawn across the road | Paper-tear rise | Peel over it or Patch |
| Buckle | 0.7 s | Road section bulges, shadow under it grows | Creak | Peel, or steer around |
| Tilt | 0.9 s | The whole road segment rotates its rail glints | Low groan | Rail grind |
| Sweep (air) | 0.6 s | A blade arc ghost at peel height | Whistle | Stay stuck, or ride the rival |
| Shake-off | 0.5 s | Rival's outline pulses | Rattle | Peel off the rival before it ends |

✚ **Threat focus rule:** only telegraphs on the next 2.0 s of road render at full contrast; the rest dim 25%.

### States
| State | Can Move | Can Act | Vulnerable | Exit |
|---|---|---|---|---|
| Stuck (road) | Yes | All | Ground + air | Peel, fall |
| Grinding | Yes | All | Air only | Leave rail |
| Peeled | 70% | Slap, Patch | Air only | Release / adhesion 0 |
| Riding rival | Steer | Kick-off, Peel | Shake-off | Peel / shake-off |
| Respawning | No | No | No | 1.0 s |
| Torn | — | — | — | Results |

### Hit Resolution
- Player hurtbox = sprite silhouette minus outline (0.6 × 0.9 m).
- Hazards always win over the player (no clashes).
- 0.8 s invulnerability after any hit (sprite flickers its border).
- No knockback; hits cost speed (30%) and outline (20).

### Rival Exposed State
After the rival's third phase, it slows for 4 s with a glowing core and a target reticle. A slap onto it during this window = **Slap-Finish (win)**.

---

## 12. Resources

### Outline (health + adhesion + build material)
- **Range:** 0–100
- **Generated by:** grinding the rail +12/s; clean transfer +5; near-miss +3
- **Spent on:** Patch −15
- **Lost by:** hit −20; fall-out −25
- **Purpose:** forces the decision between "patch the road" and "keep my life."
- **Visual:** border thickness maps linearly from 4 px (100) to 0 px (0); below 25 the border flickers and frays.

### Adhesion (peel time)
- **Range:** 0–1.5 s
- **Drains:** 1.0/s while peeled
- **Refills:** fully on any slap
- **Visual:** the peel curl straightens as adhesion runs out; at 0.3 s left the edge flutters.

| Gain | Amount | Spend | Amount |
|---|---|---|---|
| Rail grind | +12/s | Patch | −15 |
| Clean transfer | +5 | Hit | −20 |
| Near-miss | +3 | Fall-out | −25 |

---

## 13. Characters / Units / Classes

### Roster Philosophy
One playable sticker (v1): **Tack**, a small round vinyl critter with a cape-tab. Six rival **Cutters**, each a distinct personality defined by its road-attack recipe.

### ✚ Content Unit Definition
**One rival =** 1 sprite set (idle, attack-tell ×2, hit, exposed, defeat), 3 phases built from the base attack set plus **exactly one signature attack**, 1 stage palette, and 1 music track. Nothing else.

### Readability Rules
- Tack is identifiable as a silhouette at 48 px tall.
- Tack always has the brightest, whitest border on screen; rivals use a dark border (inverse sticker).
- Hazards use no white at all.

### Rivals (v1)
| # | Rival | Personality | Signature attack | Stage |
|---|---|---|---|---|
| 1 | **Snip** | Cocky rookie | Double Cut (two gaps, 0.4 s apart) | Neon Overpass |
| 2 | **Crease** | Methodical | Fold: folds the road back over itself; ride the underside | Origami Belt |
| 3 | **Gloss** | Showoff | Mirror Lane: a fake copy of the road; the real one has a shadow | Chrome Nebula |
| 4 | **Residue** | Grimy trickster | Glue Patch: sticky tiles that drain speed but restore outline | Tar Comet |
| 5 | **Halftone** | Glitchy | Dot Road: the road dissolves into dots that only exist in rhythm | Print Storm |
| 6 | **The Guillotine** | Final boss | Full Sever: cuts the road completely; the race moves onto its body | The Cutting Mat |

---

## 14. AI / NPC Design
- **AI should:** perform scripted-plus-reactive patterns, always telegraph, and rubber-band gently to stay on screen.
- **AI should not:** cut directly under the player without tells, or pull out an unwinnable lead.
- **States:** Lead, Flank, Attack (phase pattern), Shake-off, Exposed, Defeated.
- **Decision inputs:** player speed, distance, outline (it attacks less below 25 outline: mercy), phase timer.
- **Difficulty:** Standard and Remix. Remix shortens windups by 20% and adds a second simultaneous attack.
- ✚ AI tick 30 Hz; it uses the same windup minimums as the Tell Table.

---

## 15. Camera
- **Perspective:** fixed 3/4 diagonal; orthographic, or a perspective camera with FOV 22°, pitch 38°, track yaw 30°.
- **Tracking:** player at 35% from the bottom-left; leads in the direction of travel by 0.25 s of speed.
- **Smoothing:** critically damped, 0.12 s.
- **Priorities:** 1) the next 2 s of road, 2) the player, 3) the rival.

| Event | Camera Response |
|---|---|
| Slap | 3-px shake, 2f zoom punch |
| Rival phase change | 0.3 s pull-back to show the new attack |
| Low outline | Slight desaturation at the edges |
| Slap-Finish | 0.5 s slow-mo, zoom on contact |
| Victory | Push in on Tack's pose |

---

## 16. Levels / Arenas / World

### Level Design Philosophy
Each stage is a single authored ribbon spline of 90–120 s at top speed, with debris islands in the void as slap targets. The ribbon's narrowness is sacred: 6 m wide, with the rail on one side and the void on the other.

### Standard Metrics
- **Length:** 2,800–3,600 m
- **Debris slap targets:** one every 80–150 m
- **Rail:** continuous on the right (lower) side, with authored breaks
- **Sightline:** at least 2.0 s of road ahead is always visible

### Stage Template
- **Fantasy:** a cosmic highway in a specific craft material (neon, paper, chrome, tar, print, cutting mat).
- **Landmarks:** one hero backdrop object per stage (a planet-sized spool, a giant ruler, etc.).
- **Hazards:** only the rival's attacks plus the stage's single static hazard type.
- **Visual identity:** palette swap plus backdrop; the track mesh is shared.

---

## 17. Progression
- **Within a duel:** none (pure skill).
- **Permanent:** rivals unlock in order; Remix and Time Attack unlock after Rival 6.
- **Cosmetics:** 6 sticker "finishes" for Tack (holo, glitter, matte, etc.), one per S-grade rival. They're purely visual.
- **Unlocks should not:** change stats.

---

## 18. Modes
| Mode | Ships | Notes |
|---|---|---|
| Rival Run (story ladder) | v1 | 6 duels |
| Time Attack | v1 | Any cleared stage, ghost of your best |
| Remix | v1 | Harder patterns |
| Local Versus (1v1, both are stickers, one is the Cutter) | Should | Post-slice |
| Online leaderboards | v1 | Vercel + Upstash, PALM-style |

---

## 19. Difficulty
- **Tests:** reading tells, routing, adhesion timing.
- **Doesn't require:** memorizing untelegraphed patterns or frame-perfect inputs.

### ✚ Pacing Curve (per duel, Standard)
| Time | Attack cadence | New threats | Player should be learning |
|---|---|---|---|
| 0–20 s | 1 attack / 4 s | Base cut | Peel over |
| 20–50 s | 1 / 3 s | + one base attack | Patch vs. peel choice |
| 50–80 s | 1 / 2.5 s | Signature attack | The rival's identity |
| 80 s+ | Combo pairs | Signature + base | Mastery; then Exposed |

✚ **Spawn rules:** road attacks appear at least 1.8 s ahead of the player, never at the player's position. At most 2 active attacks at once (3 in Remix).

---

## 20. UX Flow
Uses the Web Shell flow: Title → Menu → Mode Select → Rival Select → Duel → Pause → Results → Retry / Next / Menu.

**Differences:** Retry is instant (one button, under 0.5 s back into play). The results screen defaults to Retry, not Menu.

**Edge cases:** focus loss = pause; controller disconnect = pause; a failed load falls back to the menu with an error toast; corrupted save resets progress and keeps settings.

---

## 21. UI / HUD

### Information Hierarchy
1. The road ahead (telegraphs)
2. Tack's border (outline) and peel curl (adhesion)
3. Rival distance
4. Time

### ✚ HUD Budget
Top-left: timer. Top edge: a thin progress track with two pips (Tack, rival). **Nothing else.** Outline and adhesion live on the sprite.

### UI Style
Die-cut sticker cards on a cutting-mat grid. Typography is a chunky rounded display face plus a condensed mono for numbers. Menus peel in and slap down.

### ✚ Glossary
| Term | Meaning |
|---|---|
| Outline | Your border; health, adhesion fuel and patch material |
| Peel | Lift off a surface |
| Slap | Stick to a surface |
| Kick-off | Burst along your current surface |
| Patch | Lay outline over a gap |
| Cutter | A rival |
| Exposed | The rival's vulnerable finish window |
| Slap-Finish | Winning by slapping the Exposed rival |
| Tear | Losing all outline |

### ✚ Callouts & Copy
SLAP! · CLEAN! · CLOSE! · PATCHED · RIDING! · EXPOSED! · SLAP-FINISH! · TORN.
Tone: short, punchy and uppercase; no exclamation points except on callouts.

---

## 22. Tutorial / Onboarding
Within 60 s the player understands: 1) peel over a cut, 2) slap onto debris, 3) grind restores outline, 4) patch a gap.

The tutorial is a no-fail practice ribbon with Snip coaching. Each prompt fades after two successful uses. Onboarding ends straight into Duel 1.

---

## 23. Visual Direction

### Visual Thesis
Tiny, hand-pixeled vinyl stickers with thick ivory die-cut borders, slapped onto a lush, smooth, low-poly 3D cosmos. The contrast is the brand: the characters look *placed*, the world looks *deep*, and lighting plus shadow make the placement feel physical.

### Character Art
- **Proportions:** chibi, 1.5 heads tall
- **Shape language:** round and soft for Tack; angular, blade-like for Cutters
- **Detail:** 48–64 px sprites with 3-tone shading
- **Silhouette:** readable at 48 px; one strong accent color each

### Environment Art
- **Geometry:** low-poly, smooth-shaded track ribbon plus giant backdrop props
- **Color:** saturated cosmic gradients; the track surface is mid-value so stickers pop
- ✚ **Value contrast rule:** void is darkest, track is mid, Tack's border is the lightest thing on screen

### ✚ Rendering Recipe
- Sprites render on billboarded quads locked to the camera's diagonal. The **die-cut border is generated in a shader** via an alpha-dilation pass (thickness uniform = outline/25 px), plus a 1-px dark keyline outside it.
- **Gloss:** a moving specular band across the sprite, driven by lateral velocity.
- **Peel:** a vertex bend on the quad's bottom edge (curl amount = peel state).
- **Contact shadow:** a hard ellipse projected onto the track normal; detaches and softens when peeled.
- **Track:** a curve-extruded mesh with emissive rail lines; bloom on emissives only.
- **Backdrop:** a skydome gradient, a parallax star layer and 1–2 hero meshes.

### ✚ Asset Pipeline
See the Art Budget appendix. Procedural first; placeholders are swappable by atlas key.

### Visual Anti-Targets
No realistic paper textures, no 8-directional sprites, no muddy dark track surfaces, nothing Sonic-adjacent.

---

## 24. Animation Direction
**Priority:** readability > responsiveness > personality > realism.

- **Style:** big squash on slap, stretch on kick-off, 1–2 frame holds on impact.
- **Peel and patch** are shader-driven, not frame-animated.

**Required set (Tack):** idle (4f), run (6f), kick-off (4f), peeled glide (2f loop), slap contact (3f), hit (2f), riding (4f), victory (8f), tear (shader).
**Rivals:** idle (4f), tell A (4f), tell B (4f), hit (2f), exposed (4f loop), defeat (6f).

---

## 25. VFX Direction
**Families:** slap ring, peel glint, wind lines, rail sparks (sticker confetti), patch strip, cut line, buckle dust, tear split.

✚ **Signature effect:** the **Slap Ring**, a flat, die-cut-bordered shockwave that "prints" onto the surface for 0.3 s like a stamp. Its Reduce-Flashes alternative is a static ring with no flash.

---

## 26. Audio Direction
- **Thesis:** tactile vinyl foley over high-tempo synth.
- **Music:** one 150–170 BPM track per rival (Suno, Mike-curated), with layers that step up per rival phase, not per time. The Exposed state drops to drums plus bass.
- **SFX cue sheet:** peel, slap (3 variants), whiff, kick-off, grind loop, patch unspool, cut tell, buckle tell, tilt tell, sweep tell, shake-off tell, hit, tear, finish stinger, UI peel/slap.
- ✚ **Distinct timbre rule:** every telegraph has a unique sound.
- **Voice:** rival barks (3 per rival, ElevenLabs) on phase change; no player voice.
- ✚ **Mix:** music ducks 4 dB for 400 ms on Heavy-tier events; telegraphs always sit above music.

---

## 27. Haptics
Follows the Impact Scale table in §10. No continuous vibration except a 10% pulse while grinding.

---

## 28. Content Matrix
| Content | Count v1 |
|---|---|
| Playable sticker | 1 (+6 finishes) |
| Rivals | 6 |
| Stages | 6 (shared track tech, unique splines and palettes) |
| Music | 7 (6 + menu) |
| Tutorial ribbon | 1 |

The builder tracks Model/Anim/FX/Audio/Complete per row in `docs/CONTENT.md`.

---

## 29. Technical Design

### 29.1 Technology
- **Engine:** Web Shell (TS) + Three.js
- **Physics:** custom track-space sim (no physics engine). The player's position is (s, lateral, height) along the spline.
- **Audio:** Web Audio via the Shell's audio module
- **Networking:** none in v1 (leaderboard via REST)
- **Persistence:** localStorage (Shell save module)
- ✚ Follows `slu-engine-decision`: web. No blocker requires Godot.

### ✚ 29.2 Foundation & Reuse
**Base:** Shell-generated.
```bash
node tools/create-slu-game.mjs --id sticker-runners --name "Sticker Runners" --renderer three --frames title,menu,select,play,pause,results
```

| System | Donor | Keep | Change |
|---|---|---|---|
| Flow / menus / save / input | Web-Game-Shell-v1.02 | All | Instant retry |
| Leaderboard | `Palm` | Shared leaderboard API on Vercel | Per-stage boards plus a ghost upload slot |
| Track / spline camera | `Infinite Dragoon` (Three.js) | Camera rig, spline sampling if present | Locked diagonal |
| Ghost replay | — (new) | — | Built generic: input-recording replay |

**Contributes back:** a billboard sticker-sprite shader (border, gloss, peel, shadow) and a spline-ribbon track generator, both written as generic Shell modules.

### 29.3 Architecture Principles
1. Sim (fixed 60 Hz) is independent from rendering.
2. All tuning lives in `config/tuning.ts`.
3. Events drive VFX and audio.
4. Seeded RNG only in the sim; there's very little RNG at all (rivals are scripted plus reactive).
5. The `window.__GAME` dev hook exposes state.
6. Placeholder procedural art (colored quads plus a shader border) until the art pass.

---

## 30. Source-of-Truth Rules
| Data | Owner |
|---|---|
| Tuning | `config/tuning.ts` |
| Rival definitions | `data/rivals/*.ts` (attack timelines) |
| Stage splines | `data/stages/*.json` |
| Duel state | `sim/Duel.ts` |
| Save | Shell persistence |

---

## 31. Tuning

| Group | Name | Value | Status | Why |
|---|---|---|---|---|
| Move | topSpeed | 32 m/s | provisional | Road crosses the screen in ~1.2 s |
| Move | kickoffCap | 44 m/s | provisional | Rewards Kick-off without breaking reads |
| Move | slapMomentumKeep | 0.92 | **LOCKED ≥0.90** | Pillar 3 |
| Peel | adhesionMax | 1.5 s | provisional | Long enough for 1 gap + 1 decision |
| Peel | slapConeDeg | 35 | provisional | Generous; Celeste-style forgiveness |
| Outline | grindGain | 12/s | provisional | ~8 s of rail = full heal |
| Outline | patchCost | 15 | provisional | 6 patches max from full |
| Outline | hitCost | 20 | provisional | 5 hits to Tear |
| Input | buffer | 5f | LOCKED | Calibration |
| Input | coyote | 6f | provisional | |
| Tells | minWindup | 0.6 s | **LOCKED** | Law 2 |
| Rival | exposedWindow | 4.0 s | provisional | |

---

## 32. Debug / Development Tools
URL flags: `?stage=`, `?rival=`, `?phase=`, `?god`, `?slow=0.25`, `?tells` (draws all hitboxes and tell timings), `?quick` (skip intro). The live tuning panel (`` ` `` key) edits `tuning.ts` values at runtime. A setTimeout step mode supports headless runs.

---

## 33. Telemetry / Playtest Metrics
| Metric | Target |
|---|---|
| First-attempt clear, Rival 1 | 40–60% |
| Attempts to clear Rival 6 | 8–20 |
| Clean transfers per minute (mid-skill) | ≥ 8 |
| Patch usage per duel | 2–5 |
| Falls caused by an "unseen" attack | 0 |

✚ **Balance harness:** a bot that plays each duel with perfect tell reads (it must always be able to clear; this proves solvability) and a bot with 250 ms reaction (target clear rate 30–70%).

---

## 34. Playtest Questions
- Did players discover that they can slap onto the rival without being told?
- Did anyone mistake the border for decoration rather than health?
- Was any attack read as unfair?
- Did players retry instantly or reach for the menu?
- When did peel start to feel like a "breath" instead of a jump?

---

## 35. Accessibility
Remapping; hold/toggle Peel; colorblind-safe tells (shape-first); Reduce Flashes; shake toggle; 0.75× Assist speed (marked on leaderboards); a high-contrast mode that thickens Tack's border and dims the backdrop 50%.

---

## 36. Performance Targets
60 fps in Chrome on a 2019 Intel MacBook Pro; sim step ≤ 1.5 ms; initial load ≤ 20 MB; draw calls ≤ 150.

---

## 37. Save / Persistence
Saves rival progress, best times and grades, finishes and settings. It saves on results and on settings change. Version-migrated via the Shell. A ghost is stored per stage (best run inputs).

---

## 38. Multiplayer / Networking
v1: none (leaderboards only). Local Versus is "Should Ship": two pads on one screen, the camera framing both.

---

## 39. Production Scope
- **Must Ship:** Tack; 6 rivals and stages; Rival Run; Time Attack with ghosts; Remix; leaderboards; tutorial; full audio; accessibility set.
- **Should Ship:** Local Versus; finishes.
- **Nice to Have:** a stage editor; online ghost sharing.
- **Out of Scope:** online real-time multiplayer, additional playable stickers, story cutscenes, a free-roam hub.

---

## 40. Build Order

### ✚ Phase 0 — Thesis Proof (1–2 weeks)
Greybox ribbon (one straight-to-curved spline), colored-quad Tack with the shader border, peel/slap/kick-off, 10 static debris targets, 5 pre-placed gaps. No rival.
- **Exit:** peeling over a gap and slapping onto debris at speed is fun in greybox. Mike plays it for 15 minutes voluntarily. **If not, stop.**

### Phase 1 — Foundation
Shell scaffold, track generator, camera, tuning panel, outline resource, grind, patch.
- **Exit:** a full 90 s greybox ribbon is playable start to finish.

### Phase 2 — Core Playable
Rival framework (attack timelines + tells), Snip complete, win/loss, results, instant retry.
- **Exit:** Duel 1 is playable end to end and passes the E2E smoke test.

### Phase 3 — Depth
Rivals 2–3, Exposed/Slap-Finish polish, style scoring, balance bots.

### Phase 4 — Content
Rivals 4–6, all stages, tutorial, Time Attack and ghosts, Remix.

### Phase 5 — Presentation
Final sprites, backdrops, VFX, music and barks.

### Phase 6 — Polish
Feel pass, accessibility, performance.

### Phase 7 — Release Candidate
Leaderboards live, a playable live URL, and name clearance.

---

## 41. Verification
✚ **Gate command:** `npm run gates` (typecheck, lint, unit tests, sim invariants, headless E2E).
✚ **E2E smoke:** title → Duel 1 → results → retry → results.

**Invariants:**
- Slap keeps ≥90% speed.
- Every attack has ≥0.6 s windup.
- Outline stays in [0, 100].
- The duel always terminates.
- The player never exists off-track while stuck.

✚ **Acceptance:** proven in a running build. A deploy counts only once its live URL has been played.

---

## 42. Definition of Done
Template checklist applies in full, plus: all 6 duels clearable by the perfect-read bot; leaderboards verified live; name cleared.

---

## 43. Definition of Great
1. A new player slaps onto the rival within their first three duels without a prompt.
2. Players hit Retry instead of Menu on 80%+ of losses.
3. Watchers can tell Tack's health from the border alone, without being told.
4. A mid-skill player chains 5+ clean transfers in one breath, and it looks choreographed.
5. ✚ **Five-second clip test:** a silent five-second clip of a peel → slap → rival-ride identifies STICKER RUNNERS and no other game.

---

## 44. Autonomous Decision Rules
Template rules 1–11 apply. In addition: **when in doubt, keep Tack stuck and fast.**

## 45. Builder Instructions
Template rules apply in full.

---

## 46. Open Questions
| Question | Importance | Working default | Blocks? |
|---|---|---|---|
| Final title (trademark check) | High | Sticker Runners (working) | No |
| Rival race vs. pure boss (does the rival need to reach the gate?) | High | Both win paths | No |
| SLU skin? | Med | Standalone | No |
| Ortho vs. narrow-FOV perspective | Med | Perspective, FOV 22° | No |
| Relationship to Rainbow Riders (merge or separate?) | High | Separate | No |

## 47. Decisions Log
| Date | Decision | Reason | Affected |
|---|---|---|---|
| 2026-10-27 | Web/Three.js over Godot | `slu-engine-decision`; no blocker; leaderboard reuse | All |
| 2026-10-27 | Rival attacks the road, not the player | Pillar 4; differentiates from fighters | AI, levels |
| 2026-11-04 | Renamed DIE-CUT → Sticker Runners (working) | Mike's call | Title, repo id |

## 48. Reference Library
`docs/refs/`:
- nandoo.px composition. Take: angle and scale contrast. Ignore: all Sonic IP.
- Die-cut sticker photos. Take: border, gloss, peel.
- Sonic CD Metal Sonic race. Take: duel tension only.

---

## 50. Final Handoff Directive
**Intended result:** a tight, gorgeous, endlessly retryable rival-racer where a tiny sticker beats six blade-spirits by mastering when to let go and where to stick, and where every pixel of the border tells you how close you are to tearing.

Repo packaging and handoff prompt are as specified in the template.

---

## Appendix — Art Budget & Process

**Why it's cheap:** one camera angle, sprites only 48–64 px, shared track tech, and peel/border/shadow/tear all done in shaders, not frames.

| Asset | Count | Frames | Process | Est. effort (solo) |
|---|---|---|---|---|
| Tack | 1 | ~37 | Concept in Scenario → hand-pixel / cleanup in Aseprite | 4–6 days |
| Tack finishes | 6 | 0 (shader params) | Shader | 1 day |
| Rivals | 6 | ~24 each | Scenario concept → Aseprite | 2–3 days each (~15 days) |
| Track mesh | 1 generator | — | Procedural | Code |
| Stage backdrops | 6 | — | Skydome gradient + 1–2 low-poly hero props (Meshy or hand-modelled) + parallax stars | 1–2 days each |
| VFX | ~10 | — | Shader / particles | 4 days |
| UI | ~8 screens | — | Sticker-card kit | 4 days |
| Music | 7 | — | Suno, curated and edited | 3–4 days |
| SFX | ~25 | — | Foley (real stickers!) + synthesis | 2 days |
| Barks | 18 | — | ElevenLabs | 0.5 day |

**Total art/audio:** ~7–9 weeks solo. Cash cost is near-zero beyond existing subscriptions. Optionally commission Tack plus 6 rivals from a pixel artist at roughly $150–400 per character, ~$1–2.5k total. That's the single best spend if your own pixel art isn't yet at the bar.

**Process order:** greybox quads (Phase 0–2) → Tack final (gate: passes the 48 px silhouette test) → rivals as each duel locks → backdrops → VFX/UI → audio.
