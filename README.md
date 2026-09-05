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

### The faces

Both fighters are real likenesses, and everything they wear comes from one pair
of photographs: a 512² face texture for the DOM UI and the fallback head, and a
3D head model (next section) reconstructed from the same shot. The sources are
freely-licensed press photographs — Sam Altman by Steve Jurvetson, Dario Amodei
by TechCrunch, both **CC BY 2.0** from Wikimedia Commons.

`scripts/build-faces.py` downloads the originals, cuts them to the crop boxes
recorded in that file, grades them so two photos shot in two different rooms
look like one game, and writes `public/faces/`:

```bash
python3 scripts/build-faces.py     # needs Pillow; re-run after changing a crop
```

It also prints the skin and hair tones it sampled off each finished face, which
are the hex values in `characters/Sam.ts` and `characters/Dario.ts` — that is
what keeps a fighter's neck and forearms matching their own head rather than a
guessed swatch.

These textures are what the character-select cards and the winner screen show,
and they are also the fallback head described below.

### The heads

The head is the one part of a fighter that is not procedural: it is a real
~4.5k-triangle photogrammetric model of the person, built by
`scripts/build-heads.py`.

```bash
python3 scripts/build-heads.py              # process (free, local, offline)
python3 scripts/build-heads.py --preview    # + render a four-sided check sheet
python3 scripts/build-heads.py --regenerate # re-run Tripo, spends credits
```

The pipeline is deliberately split at the expensive step. Tripo image-to-3D
turns the head crop into a mesh and its conversion task decimates it to 5k
triangles with the UVs intact — that costs credits, so its output is kept in
`assets/source/heads/` and reused. Like everything else in `assets/source/` it
is git-ignored, so a fresh clone spends credits once (`--regenerate`) and never
again. Everything downstream of it is local, deterministic and free to re-run:

1. yaw the mesh so the face looks down +Z, like the rest of the rig
2. cut the shoulders off along a *tilted* neck plane — a flat cut high enough to
   clear the collar behind the ears has already taken the chin off in front
3. drop orphaned vertices, normalise to one unit tall with the origin at the
   base of the neck, and re-grade + shrink the texture to 512²

The shipped result is ~200-310 kB per head, against ~3.3 MB for what Tripo
hands back, and those files *are* committed under `public/models/`.
Only the geometry and the texture are used; `rig/buildRig.ts` builds the
material itself so the head answers to the same hit-flash channel as every other
body part.

Two things make it read as the right person rather than a blob on a body:

- **The head turns towards the camera.** The arena camera is always
  perpendicular to the line between the fighters, so squared up they would be in
  pure profile — the one angle at which a real face is hardest to place. The
  director yaws the head by `HEAD_TURN_MAX * sin(angle to camera)`, and drops it
  to zero while a fighter is on the floor.

  Two details there are load-bearing, both learned the hard way. The yaw is
  **assigned to the head mesh, never added to the Head bone**: three's
  `PropertyMixer.apply()` writes an animated value back to the scene graph only
  when it changed since the last frame, and the Head track is a constant in WALK
  and RUN (they inherit it unchanged from `STANCE`), so a moving fighter has a
  Head bone the mixer stops touching — and anything added to it per frame
  compounds instead of resetting. The first version of this did exactly that and
  wound the heads up past 5000 degrees. And the amount is a **sine, not a clamped
  angle**: side-on, the camera is ~90 degrees off a fighter's facing, so a clamp
  is pinned at its limit essentially always, then flips sign the moment a
  crossover carries `facing` past pointing away. `sin` eases through zero there
  instead.
- **The head carries its own light.** The arena ambient is a strong blue; a
  purely lit head comes out grey. Most of what you see is the emissive copy of
  the texture.

Loading is asynchronous and failure is not fatal: `rig/heads.ts` resolves to
`null` rather than rejecting, and a fighter whose model is missing keeps the
blocky fallback head — a box with the face texture on its two side faces (the
sides, for the same profile reason as above). `Game.tsx` warms both models at
startup, so in practice the fallback is never seen.

### The gloves and shoes

The hands and feet are real models too, built by `scripts/build-gear.py` with the
same three commands and the same split at the expensive step.

These come from Tripo *text*-to-3D rather than image-to-3D, which matters twice
over. There is no press photo of anyone's forearm, so there was nothing to
reconstruct from — and because nothing here derives from a photograph, the gear
carries no attribution obligation the way the heads do. It also plays to the
generator's strengths: generative 3D is notoriously bad at bare hands and
reliably good at gloves, so a clenched glove sidesteps the fingers entirely.
Worth knowing if you re-prompt: the first attempt spelled out "clenched fist
shape… no hand, no arm, no person" and came back a faceted shard with 90% of its
vertices in one lump. `"a red boxing glove, product render"` worked first try —
these models follow a plain noun phrase far better than a list of prohibitions.

One glove and one shoe are generated, not four. `rig/gear.ts` mirrors each across
X for the other side, which halves the download for parts that are by definition
the same object. Mirroring is not just negating the positions: a reflection
reverses the handedness of every triangle, so the winding has to be flipped back
or the mesh renders inside-out and gets culled away. The check for this is that
the mirrored geometry's signed volume stays **positive** — it is +0.136 for the
glove either way round, where a missed winding flip would read −0.136.

The glove ships near-greyscale so `buildRig.ts` can multiply it by each fighter's
accent colour and get two different gloves out of one asset; the black cuff trim
is luminance detail and survives the tint. It is also scaled **non-uniformly** —
a correctly-proportioned glove is about 0.6 as wide as it is long, which on this
rig comes out narrower than the forearm capsule it is meant to swallow, so the
arm pokes out through its sides. Scaling up uniformly instead would put the
fighters' hands below their knees. Same argument as the oversized head: these are
caricatures, and a part has to read at the size it actually occupies on screen.

Giving the fighters gloves also exposed something that had been wrong all along
and invisible: **no pose in `animations/clips.ts` ever set a wrist.** The hand
was a symmetric box, so its roll could not be seen, and the glove's striking face
— +Z in Hand space — inherited whatever the arm chain happened to produce. In the
old stance that was up and *backwards*, pointing the knuckles away from the
opponent.

Both the guard and the wrists are now solved rather than eyeballed
(`scripts/` has no copy of this; it was a throwaway, and the results are baked
into the poses). The wrist solve holds each pose's authored Arm and ForeArm
angles fixed — that animation reads well and was not worth disturbing — and
searches only the Hand bone. Every answer came back as a pure Y roll, which is
forearm pronation: the anatomically correct degree of freedom, and free here
because the forearm capsule is rotationally symmetric so the twist cannot be
seen. Where a glove already points at the opponent the problem correctly goes
indifferent, since the striking face can only ever be perpendicular to the
glove's own long axis.

Two things that solve needs to be worth anything. **Joint limits**: unconstrained
it will happily hit every target with a shoulder twisted 116° and an elbow that
bends backwards. And **a check against the torso**: the first guard it produced
was a textbook tight one, elbows against the ribs — which from the side-on arena
camera buried both arms behind the chest block, exactly as the old stance comment
warned. The shipped guard holds the gloves 0.24 m and 0.32 m ahead of the body so
they silhouette against the arena instead.

Measured in-game over a full idle breathing cycle, all four gloves now face the
opponent (+0.31 to +0.75, against −0.26 and −0.36 before) and sit at 1.30–1.32 m
on a 1.72 m fighter — chin height. A thrown punch peaks at 0.44 m of reach with
its striking face at +0.72, so it lands knuckles-first.

**Only rigid parts belong here, and that is the whole design.** A glove barely
rotates against the wrist and a shoe barely rotates against the ankle, so a solid
mesh bolted to one bone is honest. Limbs are not like that. A capsule's
hemispherical cap *is* a ball joint — two of them rotating about a shared point
interpenetrate at any angle, so an elbow or knee never opens a seam. Swap either
for a solid scanned forearm and the joint tears open the moment it bends, and the
generator bakes the photo's own elbow bend into the vertices besides. Torsos have
the same problem at the waist, where `Spine` and `Chest` are deliberately
separate bones. The fix for those is not twelve rigid parts but one *skinned*
body that deforms through its joints — which `rig/bones.ts` already anticipates
with its Mixamo naming, and which would leave the clips and state machine
untouched.

### The licence

This is the constraint to respect if you touch any of it. CC BY allows the crop,
the grade, the 3D reconstruction and commercial use, but the attribution has to
travel with the game. It is in `public/faces/CREDITS.md`,
`public/models/CREDITS.md` and, most importantly, on the main menu.

It covers the faces and the heads only. `glove.glb` and `shoe.glb` are generated
from text and derive from no photograph, so nothing is owed on them — do not
delete the credit line on the assumption that this now applies to everything
under `public/models/`.

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
