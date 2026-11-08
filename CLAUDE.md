# Sticker Runners — Builder Law

Source of truth: `docs/GDD.md`. This file is the always-loaded law. If they conflict, the GDD wins on design; this file wins on process.

## What we're building
A rival-duel racer. You are a living sticker (Tack) on a ribbon highway in space. Peel off the road to dodge, slap onto any surface (including the rival) to keep momentum, spend your own outline to patch the road your rival cuts.

## Current phase: Phase 0 — Thesis Proof
Answer one question: **does peel → slap at speed feel unlike anything else?** Build only what Phase 0 lists (GDD §40). Nothing from later phases. No rival, no menus beyond the Shell default, no art.

## Pillars (reject anything that violates one)
1. **Stick or Fall** — you are always stuck or peeled. No jump, no double jump, no free flight.
2. **The Sticker Is the HUD** — outline thickness = health, peel curl = adhesion. No health bars.
3. **Momentum Is Sacred** — transitions never silently delete speed.
4. **The Road Is the Fight** — the rival attacks the track, not the player. (Phase 2+)

## Laws (pass/fail tests)
1. A slap preserves **≥ 90%** of entry speed. Always. (`slapMomentumKeep` is LOCKED ≥ 0.90)
2. Every road attack telegraphs **≥ 0.6 s** ahead, by shape on the track.
3. One sprite angle only (3/4 diagonal). No turnaround sheets.
4. Outline is the only health. If it's not visible on the sticker, it doesn't exist.
5. **Verified, not reported.** Done = proven in a running build.

## Anti-pillars
Not a combo fighter. Not a free-roam isometric platformer. Not an endless runner. Never unreadable at speed. Nothing Sonic-adjacent (no blue hedgehogs, rings, SEGA iconography or names).

## Tech
- Base: Shell-generated from `mikeylambo/Web-Game-Shell-v1.02`:
  `node tools/create-slu-game.mjs --id sticker-runners --name "Sticker Runners" --renderer three --frames title,menu,select,play,pause,results`
- TypeScript + Three.js. No physics engine: custom track-space sim, player position = (s, lateral, height) along a spline.
- Sim at fixed 60 Hz, independent of rendering. Events drive VFX/audio.
- All tuning in `config/tuning.ts`, every value with a `// why` comment. Live tuning panel on the `` ` `` key.
- Seeded RNG in sim only. `window.__GAME` dev hook exposes state.
- Placeholder art only: colored quads + the shader-generated die-cut border. Placeholders swappable by atlas key.
- One file per system. No monkey-patching.

## Tuning starting values (GDD §31)
topSpeed 32 m/s · kickoffCap 44 · absCap 55 · accel 0→32 in 1.6 s · lateral 9 m/s · ribbon width 6 m
adhesionMax 1.5 s, drain 1.0/s, full refill on slap · slapCone 35° · peel forward decay 4%/s
buffer 5f (LOCKED) · coyote 6f · slap hitstop 4f, shake 3 px

## Process
- Run `npm run gates` (typecheck, lint, unit tests, sim invariants, headless E2E) before every commit.
- Sim invariants to test: slap keeps ≥ 90% speed; outline ∈ [0,100]; player never off-track while stuck.
- URL flags: `?god`, `?slow=0.25`, `?tells`, `?quick`. Provide a setTimeout step mode for headless runs.
- Unspecified + reversible + doesn't change feel → choose, continue, log in `DECISIONS.md`.
- Never silently substitute an easier mechanic for a hard one. Say so.
- Report only what's verified: "pushed" ≠ "deployed" ≠ "playable." Say which.
- After any large write, confirm the file is complete and the build runs.
- When in doubt: keep Tack stuck and fast.
