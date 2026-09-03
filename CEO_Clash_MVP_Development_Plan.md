# Task: Create `CEO_Clash_MVP_Development_Plan.md`

Create a complete Markdown file named:

`CEO_Clash_MVP_Development_Plan.md`

The purpose of this document is to serve as the **master development plan/specification for building a browser-based 3D fighting game MVP**.

## Game Concept

Working title: **CEO Clash**

The game is a fictional, exaggerated, comedic/parody-style 3D fighting game where:

* The player chooses between **Sam Altman** and **Dario Amodei**.
* The selected character is controlled by the player.
* The other character is controlled by game AI.
* They fight in a small 3D arena using hand-to-hand combat.
* The game should feel intentionally ridiculous, chaotic, funny, and addictive rather than realistic.
* Characters should be full-body 3D humanoid avatars.
* Their entire bodies should animate during movement, punches, kicks, blocking, getting hit, falling, standing up, etc.
* The game should run directly in the browser.

This is a **fictional parody game**, not an attempt to depict real events or real behavior by these people. Characters should be presented in a clearly stylized/game-like manner.

---

# Technical Direction

The planned stack is:

* React
* TypeScript
* Three.js
* React Three Fiber
* `@react-three/drei`
* Rapier / `@react-three/rapier`
* Zustand or another lightweight state-management solution
* Vite or Next.js, whichever is most appropriate for the project
* GLB/GLTF for runtime 3D assets
* Mixamo for animations
* Tripo or another AI 3D-generation tool for creating the initial character models
* Blender when manual cleanup/conversion is required

The document should explain why each technology is being used and where it fits.

---

# Core MVP

The MVP must remain extremely small.

The first playable version should contain:

1. Main menu
2. Character selection
3. One arena
4. Two fighters
5. Player movement
6. Opponent AI
7. Punch
8. Kick
9. Block
10. Hit reactions
11. Knockback
12. Knockdown
13. Getting back up
14. Health bars
15. KO condition
16. Winner screen
17. Rematch button
18. Basic sound effects
19. Basic particles/camera shake
20. One special attack per character

The target gameplay loop is:

```text
Open website
    ↓
Click Play
    ↓
Choose Sam or Dario
    ↓
Arena loads
    ↓
Opponent appears
    ↓
3-second countdown
    ↓
Fight
    ↓
Attack / Block / Dodge / Get Hit
    ↓
Health reaches 0
    ↓
KO animation
    ↓
Winner screen
    ↓
Rematch
```

The MVP should prioritize **fun and responsiveness over graphical quality**.

---

# Gameplay Philosophy

The game should feel like a brainrot/hypercasual fighting game.

Important principles:

* Extremely easy to understand
* Immediate action
* Short matches
* Fast retries
* Funny animations
* Exaggerated hit reactions
* Strong sound effects
* Camera shake
* Particle effects
* Absurd special attacks
* Memorable announcer/UI text
* No complicated combos initially
* No complicated progression system initially

A player should understand the basic game within approximately 10 seconds.

The first playable match should ideally last around:

**30 seconds – 2 minutes**

---

# Controls

Use simple keyboard controls for the initial MVP.

Suggested controls:

```text
W / A / S / D → Movement

J → Punch

K → Kick

L → Block

SPACE → Special Attack
```

Keep the controls configurable later.

The document should explain how the input system should be structured so it can easily be changed later.

---

# Characters

## Sam Altman

Game-stat example:

```text
Speed:       80
Attack:      60
Defense:     50
Aggression:  80
Special:     AI-themed
```

## Dario Amodei

Game-stat example:

```text
Speed:       60
Attack:      70
Defense:     80
Aggression:  60
Special:     AI-themed
```

These numbers are **gameplay values only** and should not imply anything about the real people.

Do not spend time balancing these numbers initially.

First make the game fun.

---

# Character Creation Pipeline

The characters should be full-body humanoid 3D models.

Recommended pipeline:

```text
Reference images
        ↓
AI 3D generation
        ↓
Initial humanoid model
        ↓
Retopology / cleanup if necessary
        ↓
Rigging
        ↓
Animation
        ↓
Export GLB/GLTF
        ↓
Three.js / React Three Fiber
```

Potential tools:

### Tripo

Use Tripo or a similar AI 3D-generation tool to create the initial stylized characters.

### Mixamo

Use Mixamo for:

* Idle
* Walking
* Running
* Punching
* Kicking
* Blocking
* Hit reaction
* Knockdown
* Getting up
* Victory
* Defeat

The document should explain the practical workflow for obtaining animations and bringing them into the project.

---

# Animation System

Do NOT manually rotate individual arms and legs in JavaScript for the main character animation.

Use skeletal animation.

The characters should have:

* Skeleton
* Bones
* Animation clips

Create an animation state machine.

Suggested states:

```text
IDLE
WALK
RUN
PUNCH
KICK
BLOCK
HIT
KNOCKDOWN
GET_UP
VICTORY
DEFEAT
SPECIAL
```

The document should explain:

* How animation states work
* How transitions work
* How movement controls animation
* How attack animations trigger hitboxes
* How hit reactions interrupt normal animations
* How knockdown transitions work
* How victory/defeat animations are triggered

---

# Combat System

Do NOT attempt to simulate a completely physically accurate human body.

Use a game-oriented combat system.

Each fighter should have:

### Hurtboxes

Areas that can receive damage.

### Attack hitboxes

Temporary collision areas activated during attack animations.

For example:

```text
Punch starts
    ↓
Punch animation plays
    ↓
Hitbox activates during impact frames
    ↓
Check opponent hurtbox
    ↓
If collision:
    Deal damage
    Apply knockback
    Play hit reaction
    Trigger sound
    Trigger particles
    Shake camera
```

Explain how this should be implemented cleanly.

---

# Physics

Use Rapier primarily for:

* Arena collision
* Character collision
* Knockback
* Boundaries
* Ground detection
* Basic physical interactions

Do NOT make the entire humanoid skeleton a complex ragdoll for the MVP.

Animation should control the character body.

Physics should support gameplay.

---

# Player Controller

Implement:

```text
Input
 ↓
Player Controller
 ↓
Movement
 ↓
Character State
 ↓
Animation
```

The player controller should support:

* Forward/backward movement
* Strafing
* Turning toward opponent
* Attack
* Kick
* Block
* Special
* Hit stun
* Knockdown
* Recovery

The player should naturally face the opponent during combat.

---

# Opponent AI

The opponent should NOT use an LLM.

Use a simple deterministic/state-machine AI.

Suggested states:

```text
IDLE
CHASE
ATTACK
BLOCK
RETREAT
RECOVER
KNOCKDOWN
```

Example behavior:

```text
If player is far away:
    CHASE

If player is close:
    Sometimes ATTACK

If player attacks:
    Sometimes BLOCK or RETREAT

If opponent is hit:
    HIT / RECOVER

If health is low:
    Become more defensive

If knocked down:
    KNOCKDOWN → GET_UP
```

The AI should intentionally be somewhat stupid/funny.

The goal is not to create an intelligent fighting-game AI.

The goal is to create an opponent that is:

* Predictable enough to understand
* Random enough to remain entertaining
* Aggressive enough to keep the game moving

---

# Camera

Use a third-person fighting-game camera.

The camera should:

* Keep both fighters visible
* Follow the midpoint between them
* Zoom out when fighters move apart
* Zoom in when they move closer
* Avoid clipping through the arena
* Shake when heavy attacks land

Suggested logic:

```text
fighterA position
        +
fighterB position
        ↓
calculate midpoint
        ↓
camera follows midpoint

distance between fighters
        ↓
controls camera zoom
```

---

# Arena

Only build ONE arena for the MVP.

Keep it simple.

Example:

```text
Small futuristic AI arena
```

Possible visual elements:

* Neon floor
* Large screens
* AI-themed advertisements
* Giant ridiculous logos
* Floating UI
* Crowd silhouettes
* Dramatic lighting

Do not spend days modeling the arena.

A simple environment is enough.

---

# Special Attacks

Each character should have one absurd AI-themed special attack.

Examples:

### Sam

Possible name:

`GPT Smash`

Concept:

A dramatic powered-up punch with:

* Large camera shake
* Particle burst
* AI-style visual effects
* Huge knockback
* Funny sound
* Slow-motion impact

### Dario

Possible name:

`Claude Counter`

Concept:

Dario blocks an incoming attack and immediately launches a powerful counter.

These are fictional game mechanics.

The special attacks should be visually ridiculous.

---

# Brainrot / Comedy Layer

This is extremely important.

The game should not feel like a serious fighting simulator.

Add:

* Ridiculous announcer text
* Over-the-top hit sounds
* Screen shake
* Funny KO messages
* Exaggerated knockback
* Particle explosions
* Slow-motion heavy hits
* Random absurd voice lines if possible
* Meme-like UI
* Funny character reactions

Example UI messages:

```text
BRO GOT BENCHMARKED 💀

CONTEXT WINDOW DESTROYED

MODEL COLLAPSED

TOKEN BURNED

HALLUCINATION DETECTED

AGENT FAILED

TRAINING RUN TERMINATED

100% INFERENCE. 0% SURVIVAL.
```

Do not overbuild this system.

A few good jokes are enough.

---

# UI

Required MVP UI:

## Main Menu

```text
CEO CLASH

SAM
VS
DARIO

[ PLAY ]
```

## Character Selection

Two large character cards:

```text
SAM
[SELECT]

DARIO
[SELECT]
```

## In-Game HUD

```text
SAM HP ██████████

            60

DARIO HP ████████░░

Special: READY
```

## Countdown

```text
3

2

1

FIGHT!
```

## Winner Screen

Example:

```text
SAM WINS

THE CEO HAS BEEN BENCHMARKED 💀

[ REMATCH ]
[ MENU ]
```

---

# Project Architecture

Design a clean project structure.

Suggested structure:

```text
src/
├── components/
│   ├── UI/
│   ├── HUD/
│   ├── Menu/
│   └── CharacterSelect/
│
├── game/
│   ├── Game.tsx
│   ├── Arena.tsx
│   ├── Camera.tsx
│   └── GameLoop.ts
│
├── characters/
│   ├── Fighter.tsx
│   ├── Sam.ts
│   ├── Dario.ts
│   └── animations/
│
├── combat/
│   ├── CombatSystem.ts
│   ├── Hitbox.ts
│   ├── Hurtbox.ts
│   ├── Damage.ts
│   └── Knockback.ts
│
├── ai/
│   └── FighterAI.ts
│
├── state/
│   └── gameStore.ts
│
├── audio/
│   └── AudioManager.ts
│
├── effects/
│   ├── HitEffect.ts
│   └── CameraShake.ts
│
└── assets/
    ├── characters/
    ├── animations/
    ├── sounds/
    └── environment/
```

The exact structure can be changed if the implementation suggests something better.

---

# Game State

Define a central game state.

Possible states:

```text
MENU
CHARACTER_SELECT
LOADING
COUNTDOWN
FIGHTING
KO
WINNER
```

Character state:

```text
IDLE
MOVING
ATTACKING
BLOCKING
HIT
KNOCKED_DOWN
GETTING_UP
DEFEATED
VICTORY
```

The document should explain the difference between:

* Global game state
* Fighter state
* Animation state
* Combat state

---

# Development Order

This is extremely important.

Do NOT start by making beautiful Sam and Dario models.

Build the game using ugly placeholder humanoids first.

Development order:

## Phase 0 — Project Setup

* Create project
* Install dependencies
* Configure TypeScript
* Create basic scene
* Render Three.js canvas

## Phase 1 — Arena

* Ground
* Lighting
* Camera
* Boundaries

## Phase 2 — Placeholder Fighter

Create a simple generic humanoid.

Implement:

* Spawn
* Movement
* Rotation
* Ground detection

## Phase 3 — Two Fighters

Add:

* Player
* AI opponent
* Facing logic
* Distance detection

## Phase 4 — Animation

Add:

* Idle
* Walk
* Punch
* Kick
* Block
* Hit
* Knockdown
* Get up

## Phase 5 — Combat

Implement:

* Attack hitboxes
* Hurtboxes
* Damage
* Hit detection
* Knockback
* Hit stun

## Phase 6 — Health / KO

Implement:

* Health
* Health bars
* KO
* Winner state
* Rematch

## Phase 7 — AI

Implement:

* Chase
* Attack
* Block
* Retreat
* Recovery

## Phase 8 — Character Selection

Add:

* Sam
* Dario
* Selection UI

## Phase 9 — Real Characters

Replace placeholder models with:

* Sam model
* Dario model

## Phase 10 — Special Attacks

Add one special attack per character.

## Phase 11 — Polish

Add:

* Sound
* Camera shake
* Particles
* UI animations
* Hit effects
* Slow motion
* Funny messages

## Phase 12 — Deploy

Deploy the browser game.

---

# Critical Development Rule

The following sequence should work BEFORE spending significant time on models and visual polish:

```text
Movement
   ↓
Punch
   ↓
Hit detection
   ↓
Damage
   ↓
Knockback
   ↓
Health
   ↓
KO
   ↓
Winner
   ↓
Rematch
```

If this loop is not fun with placeholder characters, better models will not fix the game.

---

# MVP Definition of Done

The MVP is considered complete when a user can:

1. Open the website
2. Click Play
3. Select Sam
4. Spawn into the arena
5. See Dario
6. Countdown appears
7. Move around
8. Dario follows the player
9. Punch Dario
10. Dario reacts
11. Dario loses health
12. Dario attacks
13. Player blocks
14. Player kicks
15. Dario gets knocked down
16. Dario gets back up
17. Continue fighting
18. Reduce Dario's health to zero
19. Dario performs KO animation
20. Winner screen appears
21. Click Rematch
22. Immediately start another fight

If all of this works reliably, the MVP is DONE.

---

# What NOT To Build in MVP

Explicitly avoid:

* Multiplayer
* Online matchmaking
* Accounts
* Login
* Leaderboards
* Shop
* Skins
* Inventory
* Multiple arenas
* 20 characters
* Complex combos
* Advanced ragdolls
* Full-body physics simulation
* LLM-powered combat AI
* Voice AI
* Procedural animation systems
* Complex progression
* Blockchain
* Mobile controls
* Monetization

These can come later.

---

# Suggested Future Features

After the MVP works, possible additions:

## More CEOs / Tech Characters

Potential fictional/parody characters from the technology world.

## More Moves

* Uppercut
* Flying kick
* Grab
* Throw
* Combo
* Dodge

## More Specials

Each character could have unique AI-themed attacks.

## More Arenas

Examples:

* AI Server Room
* Data Center
* Silicon Valley
* GPU Factory
* AI Lab
* Giant Computer

## Game Modes

* Survival
* Tournament
* Boss Fight
* 2v2
* Endless Mode

## Internet/Brainrot Features

* Daily challenge
* Random modifiers
* Meme announcer
* Random arena events
* Extremely exaggerated KO effects

---

# Performance Considerations

The game should run smoothly in a browser.

Keep the MVP lightweight.

Priorities:

1. Stable FPS
2. Fast loading
3. Low input latency
4. Responsive combat
5. Reasonable 3D model complexity

Avoid unnecessarily high-poly models.

Use:

* GLB
* Compressed textures
* Reasonable texture sizes
* Reused animation clips
* Efficient collision detection

Do not optimize prematurely.

First make it work.

---

# Asset Pipeline Checklist

For each character:

```text
[ ] Generate 3D model
[ ] Clean topology
[ ] Rig humanoid skeleton
[ ] Test skeleton
[ ] Obtain idle animation
[ ] Obtain walk animation
[ ] Obtain run animation
[ ] Obtain punch animation
[ ] Obtain kick animation
[ ] Obtain block animation
[ ] Obtain hit animation
[ ] Obtain knockdown animation
[ ] Obtain get-up animation
[ ] Obtain victory animation
[ ] Obtain defeat animation
[ ] Export GLB
[ ] Test in Three.js
```

---

# Combat Feel Checklist

Before calling the combat system complete, verify:

```text
[ ] Punch has anticipation
[ ] Punch has impact frame
[ ] Hitbox activates only during impact
[ ] Opponent reacts immediately
[ ] Damage is visible
[ ] Knockback feels satisfying
[ ] Hit sound plays
[ ] Camera shakes
[ ] Particles appear
[ ] Player cannot spam attacks infinitely
[ ] Blocking works
[ ] Knockdown works
[ ] Getting up works
```

---

# AI Checklist

```text
[ ] AI can detect player
[ ] AI can move toward player
[ ] AI can stop at attack distance
[ ] AI can punch
[ ] AI can kick
[ ] AI can block
[ ] AI can retreat
[ ] AI reacts when hit
[ ] AI can get knocked down
[ ] AI can recover
[ ] AI can lose
```

---

# Polish Checklist

Only after gameplay is working:

```text
[ ] Character models
[ ] Arena visuals
[ ] Lighting
[ ] Materials
[ ] Particles
[ ] Camera shake
[ ] Hit effects
[ ] Sound effects
[ ] UI animations
[ ] Countdown animation
[ ] KO animation
[ ] Winner animation
[ ] Funny messages
[ ] Background music
```

---

# Development Strategy

Follow this philosophy throughout development:

> **Gameplay first. Assets second. Polish third.**

Do not spend 3 days creating the perfect character before knowing whether punching another character feels good.

Build the smallest possible vertical slice.

The ideal first milestone is:

```text
ONE ARENA
+
TWO UGLY HUMANOIDS
+
MOVEMENT
+
PUNCH
+
DAMAGE
+
KO
+
REMATCH
```

Once that works, everything else becomes an upgrade.

---

# Estimated Development Time

Assuming focused development:

### Fast Prototype

Approximately:

**5–7 focused days**

### Playable MVP

Approximately:

**10–14 focused days**

### Polished Public MVP

Approximately:

**2–4 weeks**

### More Complete Game

Approximately:

**1–3 months**

These are rough estimates and depend heavily on how much time is spent creating/customizing 3D assets and polishing combat.

---

# Suggested Milestone Schedule

## Day 1

Project setup + Three.js scene + arena + camera.

## Day 2

Placeholder fighter + movement + facing.

## Day 3

Second fighter + basic AI.

## Day 4

Punch + hitbox + damage.

## Day 5

Kick + block + knockback.

## Day 6

Health + KO + winner + rematch.

## Day 7

Animation state machine.

At this point there should already be a playable fighting game.

## Days 8–10

Character models + rigging + Mixamo animations.

## Days 11–12

Character selection + special attacks.

## Days 13–14

Sound + particles + camera shake + UI polish.

After this, deploy the MVP and collect feedback.

---

# Recommended First Implementation

Start with a completely generic placeholder fighter.

For example:

```text
Capsule / low-poly humanoid
```

Do not use Sam or Dario yet.

Implement:

```text
Player
    ↓
Move
    ↓
Face enemy
    ↓
Punch
    ↓
Hit enemy
    ↓
Enemy loses HP
    ↓
Enemy gets knocked back
    ↓
Enemy attacks
    ↓
Player loses HP
    ↓
Someone reaches 0 HP
    ↓
KO
    ↓
Winner
    ↓
Rematch
```

Once this works, replace the placeholder with the real stylized characters.

---

# Final MVP Architecture

The final MVP should conceptually look like:

```text
                ┌───────────────────┐
                │    Main Menu      │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │ Character Select  │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │      Arena        │
                │                   │
                │   Player          │
                │      ↕            │
                │   Opponent AI     │
                │                   │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │ Combat System     │
                │                   │
                │ Hitboxes          │
                │ Hurtboxes         │
                │ Damage            │
                │ Knockback         │
                │ Health            │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │       KO          │
                └─────────┬─────────┘
                          │
                          ▼
                ┌───────────────────┐
                │  Winner Screen    │
                │                   │
                │    REMATCH        │
                └───────────────────┘
```

---

# Final Goal

The ultimate goal of the first version is NOT to build a technically impressive fighting engine.

The goal is:

> **Make someone play one fight, laugh, lose, immediately press Rematch, and play again.**

If the player naturally wants to press **Rematch**, the MVP has succeeded.

Create this entire document as:

`CEO_Clash_MVP_Development_Plan.md`

Do not merely print the Markdown in the terminal.

Actually create the file in the current project directory.

After creating it, verify that:

```bash
ls -l CEO_Clash_MVP_Development_Plan.md
```

shows the file exists.

Then briefly report:

* File created
* File path
* Approximate number of sections
* Whether the file was successfully verified
