# CEO CLASH

A browser 3D fighting game. Six stylised parody tech CEOs, one neon arena,
hand-to-hand combat, and a Rematch button you are meant to hit immediately.

Built to `CEO_Clash_MVP_Development_Plan.md`, which remains the spec.

> Unaffiliated parody. Not endorsed by, or associated with, anyone depicted or
> their companies. The fighters wear real likenesses built from public domain
> and CC-licensed photos (credited on the main menu and in the CREDITS files).
> The stat numbers are gameplay dials and nothing else.

## Run it

```bash
bun install
bun run dev        # http://localhost:5173
bun run build      # typecheck + production bundle
bun run sim        # headless fight simulation (see "Verification")
bun run balance    # round-robin win rates and match lengths
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
N         new opponent, on the winner screen

Character select: arrows move, Enter picks, Esc goes back.
Touch: tap a fighter to read their card, tap again to pick.
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
│   ├── roster.ts           the fighter id list; FighterId is derived from it
│   ├── index.ts            id -> def, random pairs, grouped photo credits
│   ├── Sam.ts, Dario.ts, Trump.ts, Elon.ts, Zuck.ts, Cook.ts
│   │                       character definitions (stats, colours, specials, lines, photo credit)
│   ├── Fighter.tsx         Rapier capsule + bone rig
│   ├── rig/                the procedural humanoid skeleton
│   └── animations/         clip library + AnimationMixer wrapper
├── ai/FighterAI.ts         deterministic opponent state machine
├── input/                  keymap and edge-triggered input collection
├── state/gameStore.ts      zustand: phase, health bars, clock, announcements
├── effects/                pooled impact particles + shockwave
├── audio/AudioManager.ts   every sound: CC0 samples, synth fallback
└── components/             menu, two-step character select, loading card, HUD,
                            countdown, winner screen
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

Every fighter is a real likeness, and everything they wear comes from one
photograph each: a 512² face texture for the DOM UI and the fallback head, and a
3D head model (next section) reconstructed from the same shot. The sources are
all on Wikimedia Commons:

| fighter | photographer | licence |
|---|---|---|
| Sam | Steve Jurvetson | CC BY 2.0 |
| Dario | TechCrunch | CC BY 2.0 |
| Donald | Shealah Craighead (White House official portrait) | public domain |
| Elon | Trevor Cokley (U.S. Air Force) | public domain |
| Mark | Anthony Quintano | CC BY 2.0 |
| Tim | Christophe Licoppe (European Commission) | CC BY 4.0 |

None is CC BY-SA, so no derived file carries ShareAlike.

`scripts/build-faces.py` downloads the originals, cuts them to the crop boxes
recorded in that file, grades them so two photos shot in two different rooms
look like one game, and writes `public/faces/`:

```bash
python3 scripts/build-faces.py            # needs Pillow; re-run after changing a crop
python3 scripts/build-faces.py elon cook  # just these
```

It also prints the skin and hair tones it sampled off each finished face, which
are the hex values in each `characters/<Name>.ts`. That is
what keeps a fighter's neck and forearms matching their own head rather than a
guessed swatch.

These textures are what the character-select cards and the winner screen show,
and they are also the fallback head described below.

### The heads

The head is the one part of a fighter that is not procedural: it is a real
~4.5k-triangle photogrammetric model of the person, built by
`scripts/build-heads.py`.

```bash
python3 scripts/build-heads.py                    # process every cached head (free, local)
python3 scripts/build-heads.py --preview          # + render a four-sided check sheet
python3 scripts/build-heads.py --photos           # write the crops Tripo would get (free)
python3 scripts/build-heads.py elon --regenerate  # re-run Tripo for ONE fighter, spends credits
```

The pipeline is deliberately split at the expensive step. Tripo image-to-3D
turns the head crop into a mesh and its conversion task decimates it to 5k
triangles with the UVs intact — that costs credits, so its output is kept in
`assets/source/heads/` and reused. Like everything else in `assets/source/` it
is git-ignored, so a fresh clone spends credits once (`--regenerate --all`) and
never again. A bare `--regenerate` with no fighter named refuses to run, and a head
with no cached output is skipped rather than silently generated.

**Status:** only Sam and Dario have head models so far. Donald, Elon, Mark and Tim
have their crops set (`--photos`), but generation is waiting on Tripo credits (the
balance was 0 when they were added, on both keys). Tripo also **rejected
Donald's photo outright** under its content policy (`code 2008`) before checking the
balance, so his head may never be generatable there, and he may keep the fallback
head for good. To use a different key from `.env`, set
`TRIPO_KEY_NAME=TRIPO_API_KEY_2` when running the script. Until then they wear the blocky fallback head
with their face photo, and `hasHead: false` on their defs stops the loader from
requesting a GLB that isn't there. Their `neck_cut`/`neck_tilt` are starting values
to tune with `--preview` once a mesh exists. Everything downstream of it is local, deterministic and free to re-run:

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
sides, for the same profile reason as above).

Heads are not preloaded at startup any more. With 6+ fighters at ~200–310 kB
a head, that would spend most of a phone's first load on faces nobody picked.
Instead, picking a matchup puts the game in the `LOADING` phase: a matchup card
shows while only that pair's heads are fetched, and the countdown starts once
both have landed or failed (capped at 8 seconds). A rematch reuses the cached
heads and skips straight to the countdown.

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
`public/models/CREDITS.md` and, most importantly, on the main menu. The menu line
is built from each def's `photo` field and grouped by licence, so a fighter
without a credit doesn't compile. Public domain photos owe nothing, but they
are credited anyway. A CC BY-SA photo would make that fighter's face and head
CC BY-SA too. `build-faces.py` and `build-heads.py` note that in the CREDITS
files automatically, but prefer a CC BY or public domain photo when one is usable.

It covers the faces and the heads only. `glove.glb` and `shoe.glb` are generated
from text and derive from no photograph, so nothing is owed on them — do not
delete the credit line on the assumption that this now applies to everything
under `public/models/`.

### Sound

Sampled where samples exist, synthesised where they do not.

```bash
bun run sounds          # fetch anything missing
bun run sounds --force  # re-fetch, e.g. after editing a query
```

`scripts/sounds.ts` pulls 19 CC0 clips from Freesound into `public/sounds/`
(744 kB, 128kbps mono mp3) and writes a `manifest.json` saying how many variants
of each sound exist. It takes the HQ mp3 *preview* of each result, which needs
only the API token and no OAuth handshake — a punch does not need 24-bit WAV, and
every byte here is on the critical path to the first fight. CC0 is preferred, so
in the normal case nothing carries an attribution obligation; a query with no CC0
results falls back to Attribution and those entries are flagged, both per-line in
`public/sounds/CREDITS.md` and in the script's summary.

**The synthesised versions are not dead code.** Each method tries a sample and
falls through when there isn't one:

```ts
hit(power = 1) {
  if (this.sample("hit", 0.9)) return;
  // ...the synthesised version, unchanged
}
```

So a missing pack, a file that fails to decode, or a fetch still in flight during
the first fight all degrade to the old behaviour instead of silence, and the game
still works offline with no audio files at all. Every sample is pitch- and
gain-randomised per impact and the variants are cycled, so twenty punches in a row
do not sound like one clip looping.

Two things were fixed on the way in from the branch this came from. `credits.push`
lived *inside* the download loop, after the early `continue` that skips files
already on disk — so any re-run without `--force` rewrote `CREDITS.md` with zero
entries and silently dropped the attribution for every sound already there. It now
credits each chosen sound whether or not it was downloaded this run. And the fetch
paths were absolute (`/sounds/...`), which breaks the moment the game is served
from a subpath; they use `import.meta.env.BASE_URL` like every other loader here.

## Verification

`bun run sim` runs the real controller, combat system and AI at a fixed 60Hz
against a stub physics body — no browser, no rendering. It is the test behind the
plan's Critical Development Rule:

```
movement → punch → hit detection → damage → knockback → health → KO → winner → rematch
```

It checks that punches damage and knock back, that blocking reduces damage to chip,
that a kick can floor someone and they get back up, that every fighter's special
works (grouped by kind: strike specials land and floor, counters absorb a punch and
punish it), and that AI-vs-AI matches across every pairing reliably end in a
knockout.

`bun run balance` runs an AI-vs-AI round-robin over every pair (200 matches a
pairing by default, alternating sides) and exits non-zero if any pairing lands
outside 35–65% or any fighter wins more than 60% overall. As of the six-fighter
roster, at 300 matches a pairing (row's win rate against column):

```
          sam dario trump  elon  zuck  cook   overall
sam         -   49%   48%   51%   45%   50%    49%
dario     51%     -   57%   52%   53%   55%    53%
trump     52%   43%     -   54%   51%   47%    49%
elon      49%   48%   46%     -   56%   48%    49%
zuck      55%   47%   49%   44%     -   48%    49%
cook      50%   45%   53%   52%   52%     -    50%

length: median 24.2s  range 11.4-62.0s  · every match decisive
```

Every pairing is inside 40–60%. The stats were tuned with one fact in mind:
they are not worth the same. Measured by moving one stat ±20 in a mirror match,
**defense and aggression swing the win rate by ~±12 points, attack by ~±6, and
speed by ~±2**. So equal stat totals do not mean equal fighters, and the fast
fighters have higher totals than the tanks.

One known gap: the AI-vs-AI median is ~24s, under the plan's 30s floor. It was
the same before the roster grew (Sam vs Dario measured ~24s on the unchanged
code), and it is short in the same direction for every pairing, so it is a
shared frame-data question (`combat/moves.ts`) rather than a per-fighter one.
It has been left alone, not tuned around.

### Adding a fighter

1. **Photo.** Find a near-frontal, evenly lit, unobstructed photo on Wikimedia
   Commons: public domain or CC BY preferred, CC BY-SA only if nothing else works.
   Note the file, author and licence.
2. **Face.** Add a `Face(...)` to `scripts/build-faces.py` (crop as fractions of the
   source, `exposure`, `skin_at`, `hair_at`), run
   `python3 scripts/build-faces.py <id>`, and compare `public/faces/<id>.webp` with
   the others. It should look like the same room.
3. **Head.** Add a `Head(...)` to `scripts/build-heads.py` with a wider crop that
   includes all the hair. Check it with `--photos`, then run
   `python3 scripts/build-heads.py <id> --regenerate` (one generation plus one
   decimation of Tripo credits). Tune `neck_cut`/`neck_tilt` with `--preview`,
   which is free. The shipped GLB should be ≤ ~320 kB.
4. **Def.** Add `<id>` to `FIGHTER_IDS` in `characters/roster.ts`, write
   `characters/<Name>.ts` modelled on the others, and register it in
   `characters/index.ts`. Fill in `special` (kind `strike` or `counter`, a
   name, and optional `tuning`), `colors` (the printed skin/hair, plus a primary
   no other fighter uses), four `koLines`, optional `bigHitLines`/`specialLines`,
   `photo`, and `hasHead`. Jokes target the persona or the company. No fake
   quotes, no politics with teeth, nothing about family, health, religion or
   ethnicity. No CSS is needed.
5. **Check.** Run `bun run build`, `bun run sim` and `bun run balance`. Tune `stats`
   and `special.tuning` until the round-robin passes (see the weights above).
   Then pick the new fighter at desktop and phone widths.
6. **Credits.** The face and head scripts rewrite both CREDITS files. The menu
   line updates itself from `photo`. Update the table under "The faces".

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
