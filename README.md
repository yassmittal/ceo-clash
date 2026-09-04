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
bun run characters # generate + rig + optimise the fighter models (needs TRIPO_API_KEY)
bun run sounds     # pull CC0 sound effects from Freesound (needs FREESOUND_CLIENT_SECRET)
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

## The characters

The fighters are original stylised parody characters — tech-CEO archetypes, not
likenesses of anyone — generated and rigged entirely through the API:

```
text prompt -> Tripo text-to-3D -> Tripo auto-rig -> gltf-transform -> public/models/*.glb
      (20 credits)                   (25 credits)      (local, free)
```

`bun run characters build all` runs the whole thing and caches every stage in
`assets/source/manifest.json`, so a re-run only redoes what is missing. Prompts
live at the top of `scripts/characters.ts`.

**No Blender and no Mixamo.** The original plan routed the whole asset pipeline
through both; neither turned out to be necessary. Tripo's auto-rigger emits a
Mixamo-*spec* skeleton (`mixamorig:Hips`, `mixamorig:LeftArm`, …), which is
exactly what the placeholder rig was named to match, so the twelve hand-authored
clips drive the generated models directly. Mesh cleanup that would have been
Blender work is `@gltf-transform` running headlessly.

### Retargeting

The clips are authored against the placeholder rig and replayed on an imported
skeleton, which needs three corrections — all computed once at load, in
`rig/retarget.ts` and `rig/gltfRig.ts`:

| Problem | Fix |
|---|---|
| Placeholder has identity rest rotations; a Mixamo rig encodes its T-pose in them | Conjugate each clip value into the target bone's parent frame: `P⁻¹ · q · A · P · rest` |
| Placeholder stands arms-down, the import stands in a T-pose | `A`, a per-bone rest correction (only the upper arms need one) |
| Generated characters are chibi — hips at 0.66m, not 0.95m | Scale hip root motion by the ratio of hip heights, and rotate it into the target's frame (this skeleton is Z-up internally) |

Facing is measured from the skeleton rather than assumed: the foot→toe vector is
the character's forward direction, and the model is yawed until it points +Z.

If a fighter ever moonwalks, faces backwards, sinks through the floor, or holds
its arms out sideways, it is one of the rows in that table.

### Bringing your own model

```
bun run characters import <file.glb> <id>     # e.g. ... import ~/Downloads/ceo.glb sam
```

This validates the export, optimises it, and installs it. Replacing `sam` or
`dario` needs no code change at all.

The export has to satisfy four things, and `import` names whichever one fails
rather than installing a model that silently will not animate:

| Requirement | Why |
|---|---|
| **`.glb`** (glTF Binary) | One file, textures embedded. Not FBX, OBJ, or glTF+bin |
| **Rigged** | The most common mistake. A plain text-to-3D or image-to-3D result is a *static mesh* with no skeleton, and cannot animate. In Tripo, run it through Animation / Rigging first |
| **Mixamo skeleton** | The clips drive 19 named bones. Lookup is normalised, so `mixamorig:Hips`, `mixamorigHips` and `Hips` all resolve |
| **T-pose** | Arms straight out to the sides. The retargeter corrects from a T-pose; an A-pose export animates with its arms wrong |

Don't pre-optimise or decimate the export — hand over the raw rigged GLB. The
pipeline knows the ratio that keeps skinning intact (below roughly 0.1 it breaks,
invisibly, until the model animates).

A brand-new fighter also needs a character definition — stats, colours, taglines
— and `import` prints the three steps. The placeholder rig stays in the tree as
the Suspense fallback, so the arena is never empty while a model streams in.

## Sound

19 CC0 clips from Freesound in `public/sounds/`, fetched by `bun run sounds`,
with several variants of each impact cycled and pitch-randomised per hit. Every
sound falls back to its synthesised version if the pack is missing, still
loading, or fails to decode — the game is never silent. `CREDITS.md` there lists
every source.

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

## What's left

See [HANDOFF.md](HANDOFF.md) — what still needs doing, what needs an account or a
key, and what can be done without either.

## What is deliberately not here

Multiplayer, accounts, leaderboards, shops, skins, multiple arenas, combo systems,
ragdolls, LLM-driven AI, progression, monetisation. All explicitly out of scope for
the MVP.
# ceo-clash
