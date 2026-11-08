# Sticker Runners — Phase 0 Handoff

## Setup (Mike, once)
1. Create repo `mikeylambo/sticker-runners`.
2. Generate from the Shell:
   `node tools/create-slu-game.mjs --id sticker-runners --name "Sticker Runners" --renderer three --frames title,menu,select,play,pause,results`
3. Drop in `docs/GDD.md` (STICKER-RUNNERS_GDD.md), `CLAUDE.md`, and an empty `DECISIONS.md`.
4. Open Claude Code in the repo and paste the prompt below.

## Prompt (paste into Claude Code)
```
Build Phase 0 of Sticker Runners from docs/GDD.md. CLAUDE.md is the law.
Phase 0 exists to answer one question: does peeling off a speeding road and
slapping onto a new surface, without losing momentum, feel unlike anything else?
Build ONLY this, in order, keeping it playable after each step:

1. Track: a spline-extruded ribbon mesh, 6 m wide, ~2,000 m long, straight
   into gentle curves. Gold rail on the lower/right edge, open void on the
   upper/left edge. Track-space sim: player = (s, lateral, height).
2. Camera: fixed 3/4 diagonal, perspective FOV 22°, pitch 38°, track yaw 30°.
   Road runs bottom-left → top-right. Player at 35% from bottom-left, leads
   by 0.25 s of speed, critically damped 0.12 s.
3. Tack: a colored quad billboard with the shader die-cut border
   (alpha-dilation, thickness = outline/25 px, + 1 px dark keyline), a hard
   contact-shadow ellipse, and a vertex bend on the bottom edge for peel curl.
4. Movement: auto-run per CLAUDE.md tuning. Steer laterally. Coyote 6f off
   the void edge. Buffer 5f.
5. Peel (hold Space / A): lift off, ground hazards pass beneath, adhesion
   drains 1.0/s from 1.5 s, forward speed decays 4%/s, 70% lateral control,
   shadow detaches and softens, curl straightens as adhesion runs out.
6. Slap (release): snap within 3f to the nearest valid surface in a 35° cone
   toward stick direction. Keep >= 92% speed. Refill adhesion. 4f hitstop,
   3 px shake, flat ring decal on the surface for 0.3 s. No target in cone =
   whiff (hollow sound, keep falling).
7. Kick-off (Shift / X) while stuck: burst toward 44 m/s cap.
8. Content: 10 static debris islands in the void as slap targets, plus at
   least one road-underside slap section. 5 pre-placed gaps in the road.
   Falling 1.0 s off-screen respawns you on the road after a 1.0 s re-stick.
9. Placeholder audio: synthesized peel "thhp", slap, whiff.
10. Tools: live tuning panel on ` key editing config/tuning.ts values;
    ?god, ?slow=0.25, ?quick flags; window.__GAME hook; setTimeout step mode.
11. Gates: npm run gates with a sim invariant test proving slap keeps
    >= 90% speed, and a headless smoke test that runs the ribbon start to end.

Do NOT build: rivals, road attacks, outline loss, patch, grind, scoring,
menus beyond the Shell default, or any final art.

Exit condition: the ribbon is playable start to finish, gates pass, and you
report with a short screen recording or screenshots as evidence. Log every
assumption in DECISIONS.md. Report what's verified, not what's pushed.
```

## Mike's kill test
Play the greybox for 15 minutes. Did you choose to keep going? Did you start finding lines between debris without being asked? If no to both, stop and rethink the verb before any art or rivals.
