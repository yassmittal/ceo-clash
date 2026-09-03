# CEO CLASH

A browser 3D fighting game. Two stylised parody CEOs, one neon arena, hand-to-hand
combat, and a Rematch button you are meant to hit immediately.

Built to `CEO_Clash_MVP_Development_Plan.md`, which remains the spec.

> Fictional parody. Not affiliated with, endorsed by, or depicting real people or
> companies. The stat numbers are gameplay dials and nothing else.

## Run it

```bash
bun install
bun run dev        # http://localhost:5173
bun run build      # typecheck + production bundle
bun run sim        # headless fight simulation (see "Verification")
bun run balance    # match-length and win-rate report
```

## Controls

```
W A S D   move (W closes distance, S backs off, A/D sidestep)
J         punch
K         kick
L         block (hold)
SPACE     special — needs a full meter
R         rematch, on the winner screen
```

Rebinding lives in `src/input/keymap.ts`. The chain is
`physical key -> ActionName -> Intent`, and the player controller only ever sees
an `Intent`, so adding a gamepad or touch pad later means producing an `Intent`
from a new source and changing nothing else.

## How it fits together

```
src/
├── game/
│   ├── Game.tsx            Canvas + Physics; stays mounted for the whole session
│   ├── GameLoop.tsx        THE DIRECTOR — the one useFrame that runs everything
│   ├── FighterController.ts  Intent -> state machine -> movement -> animation
│   ├── Arena.tsx           the one arena: neon disc, light walls, jumbotrons, crowd
│   ├── Camera.ts           midpoint-follow fighting camera with distance zoom + shake
│   ├── runtime.ts          FighterRuntime: the mutable 60fps simulation state
│   ├── types.ts            the four kinds of state, kept deliberately separate
│   └── brainrot.ts         the entire comedy layer
├── combat/
│   ├── moves.ts            ALL frame data and tuning constants
│   └── CombatSystem.ts     hitboxes, hurtboxes, damage, knockback, block, parry
├── characters/
│   ├── Sam.ts / Dario.ts   character definitions (stats, colours, specials)
│   ├── Fighter.tsx         Rapier capsule + bone rig
│   ├── rig/                the procedural humanoid skeleton
│   └── animations/         clip library + AnimationMixer wrapper
├── ai/FighterAI.ts         deterministic opponent state machine
├── input/                  keymap and edge-triggered input collection
├── state/gameStore.ts      zustand: phase, health bars, clock, announcements
├── effects/                pooled impact particles + shockwave
├── audio/AudioManager.ts   every sound, synthesised with Web Audio
└── components/             menu, character select, HUD, countdown, winner screen
```

### Four kinds of state, on purpose

The plan asks for the distinction and the code keeps it:

| | where | changes at |
|---|---|---|
| **Global game state** | `state/gameStore.ts` (zustand) | phase transitions, ~20Hz HUD snapshot |
| **Fighter state** | `FighterRuntime.state` | gameplay events |
| **Combat state** | `FighterRuntime.combat` | per attack: startup / active / recovery |
| **Animation state** | derived in `syncAnimation` | every frame, from the two above |

Animation state is never authored — it is a pure function of gameplay state, so
the pose can't disagree with what the combat system thinks is happening. And the
simulation never writes to React state at 60fps, which is what keeps input latency
low; the store gets a summary twenty times a second.

### One loop, one order

`GameLoop.tsx` owns every per-frame behaviour, in a fixed sequence: advance the
clock (hitstop / slow motion) → read Rapier → gather intents → run both
controllers → resolve hitboxes → write velocities and clamp to the arena → camera
and HUD. Hits therefore land on the frame the animation says they should, rather
than a frame late depending on which component happened to run first.

### Physics vs. animation

Rapier owns positions: capsule bodies, the octagon of light walls, the floor,
gravity, and fighters shoving each other apart. Animation owns the body: bones are
driven by an `AnimationMixer`, never by rotating meshes from JavaScript. There is
no ragdoll — the plan rules it out for the MVP, and a knockdown is an animation
plus a decaying knockback vector.

Hit detection is a sphere in front of the chest, active only during a move's
active frames, tested against a vertical capsule hurtbox. Deterministic and
tunable, which is what a fighting game needs; per-bone collision is not.

## The characters, and swapping in real models

The fighters are a **procedurally built humanoid rig**: a real bone hierarchy
(`characters/rig/bones.ts`, named to match Mixamo minus the `mixamorig:` prefix)
with chunky body-part meshes parented to the bones, animated by twelve
hand-authored `AnimationClip`s (`characters/animations/clips.ts`).

This is the plan's Phase 2 placeholder taken as far as it is useful — and it means
Phase 9 is a drop-in rather than a rewrite:

1. Generate/clean/rig the model (Tripo → Blender → Mixamo), export GLB with the
   clips named `IDLE`, `WALK`, `RUN`, `PUNCH`, `KICK`, `BLOCK`, `HIT`,
   `KNOCKDOWN`, `GET_UP`, `VICTORY`, `DEFEAT`, `SPECIAL`.
2. In `characters/Fighter.tsx`, replace `buildRig()` / `buildClips()` with
   `useGLTF` and the GLB's own `animations`.
3. Match the clip lengths to the frame data in `combat/moves.ts` (punch 0.35s with
   impact at ~0.13s, kick 0.65s at ~0.24s, special 1.12s at ~0.42s) — or scale
   them with `Animator.play({ timeScale })`.

Nothing else changes. `Animator`, the state machine, combat, AI and camera are all
model-agnostic.

Sound is synthesised rather than sampled for the same reason: it loads instantly,
weighs nothing, and every impact is pitch-randomised so twenty punches do not sound
like one looping sample. Swapping in recordings means replacing the method bodies
in `audio/AudioManager.ts`.

## Verification

`bun run sim` runs the real controller, combat system and AI at a fixed 60Hz
against a stub physics body — no browser, no rendering. It is the test behind the
plan's Critical Development Rule:

```
movement → punch → hit detection → damage → knockback → health → KO → winner → rematch
```

It checks that punches damage and knock back, that blocking reduces damage to chip,
that a kick can floor someone and they get back up, that both specials work
(including Dario's parry-into-counter), and that two AIs reliably fight to a
knockout inside the target match length.

Balance sanity as of writing: 40 AI-vs-AI matches ran 21/19, every one decisive,
23–64 seconds — inside the plan's 30s–2min window.

### Poking at a live fight

In dev only, `window.ceoClash` exposes `{ fight, store, input }`, so you can drive
the game from the console while it runs:

```js
ceoClash.fight.opponent.health = 5      // set up a KO
ceoClash.fight.player.meter = 100       // charge the special
ceoClash.store.getState().rematch()     // restart
```

The bridge is behind `import.meta.env.DEV` and is stripped from production builds.

## Known trade-off: bundle size

Rapier ships its physics engine as inlined wasm and is ~816kB gzipped — by far the
largest thing the game downloads, and more than everything else combined:

```
rapier  816 kB gzip
three   176 kB
react    43 kB
game     19 kB
```

The plan names Rapier in the stack, so it stays. But it is worth being clear about
what it buys here: gravity, the floor, the octagon of walls, and two capsules
shoving each other apart. Knockback, hit detection, arena bounds and all movement
are already handled in game code. If load time ever matters more than the stack
choice, replacing Rapier with ~50 lines of capsule-vs-capsule separation would cut
the download by roughly 80% and change nothing the player can see.

## What is deliberately not here

Multiplayer, accounts, leaderboards, shops, skins, multiple arenas, combo systems,
ragdolls, LLM-driven AI, progression, monetisation. All explicitly out of scope for
the MVP.
# ceo-clash
