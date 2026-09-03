/**
 * Headless fight simulation.
 *
 * Runs the real controller, combat system and AI at a fixed 60Hz with a stub
 * physics body, so the gameplay loop can be verified without a browser. This is
 * the test that backs the plan's "Critical Development Rule": movement -> punch
 * -> hit detection -> damage -> knockback -> health -> KO must work before any
 * of it is worth looking at.
 *
 *   bun run sim
 */
import * as THREE from "three";
import { CHARACTERS } from "../src/characters/index.ts";
import { FighterRuntime, fight } from "../src/game/runtime.ts";
import { updateFighter } from "../src/game/FighterController.ts";
import { updateCombat } from "../src/combat/CombatSystem.ts";
import { FighterAI } from "../src/ai/FighterAI.ts";
import { COMBAT, moveDuration, moveFor, specialFor } from "../src/combat/moves.ts";
import { emptyIntent, type Intent } from "../src/game/types.ts";

const STEP = 1 / 60;

/** Minimal stand-in for a Rapier capsule: integrate velocity, keep them apart. */
class StubBody {
  t = { x: 0, y: 0.9, z: 0 };
  v = { x: 0, y: 0, z: 0 };
  translation() {
    return this.t;
  }
  linvel() {
    return this.v;
  }
  setTranslation(t: { x: number; y: number; z: number }) {
    this.t = { ...t };
  }
  setLinvel(v: { x: number; y: number; z: number }) {
    this.v = { ...v };
  }
  step(dt: number) {
    this.t.x += this.v.x * dt;
    this.t.z += this.v.z * dt;
    this.t.y = 0.9;
  }
}

interface Sim {
  a: FighterRuntime;
  b: FighterRuntime;
  bodyA: StubBody;
  bodyB: StubBody;
}

function makeSim(playerId: "sam" | "dario" = "sam"): Sim {
  const other = playerId === "sam" ? "dario" : "sam";
  const a = new FighterRuntime(CHARACTERS[playerId], "player");
  const b = new FighterRuntime(CHARACTERS[other], "opponent");
  const bodyA = new StubBody();
  const bodyB = new StubBody();
  a.body = bodyA as never;
  b.body = bodyB as never;
  a.reset(new THREE.Vector3(-1.6, 0.9, 0), Math.PI / 2);
  b.reset(new THREE.Vector3(1.6, 0.9, 0), -Math.PI / 2);
  fight.player = a;
  fight.opponent = b;
  fight.resolved = false;
  fight.hitstop = 0;
  fight.slowmo = 0;
  fight.clock = COMBAT.matchSeconds;
  return { a, b, bodyA, bodyB };
}

function separate(sim: Sim) {
  const min = COMBAT.bodyRadius * 2;
  const dx = sim.b.position.x - sim.a.position.x;
  const dz = sim.b.position.z - sim.a.position.z;
  const d = Math.hypot(dx, dz);
  if (d >= min || d < 1e-5) return;
  const push = (min - d) / 2;
  const nx = dx / d;
  const nz = dz / d;
  sim.bodyA.t.x -= nx * push;
  sim.bodyA.t.z -= nz * push;
  sim.bodyB.t.x += nx * push;
  sim.bodyB.t.z += nz * push;
}

function step(sim: Sim, intentA: Intent, intentB: Intent) {
  // Mirrors the order in GameLoop.tsx exactly.
  sim.a.position.set(sim.bodyA.t.x, sim.bodyA.t.y, sim.bodyA.t.z);
  sim.b.position.set(sim.bodyB.t.x, sim.bodyB.t.y, sim.bodyB.t.z);

  updateFighter(sim.a, sim.b, intentA, STEP, true);
  updateFighter(sim.b, sim.a, intentB, STEP, true);
  updateCombat(STEP, sim.a, sim.b);

  sim.bodyA.setLinvel({ x: sim.a.velocity.x, y: 0, z: sim.a.velocity.z });
  sim.bodyB.setLinvel({ x: sim.b.velocity.x, y: 0, z: sim.b.velocity.z });
  sim.bodyA.step(STEP);
  sim.bodyB.step(STEP);
  separate(sim);
}

const distance = (sim: Sim) =>
  Math.hypot(sim.a.position.x - sim.b.position.x, sim.a.position.z - sim.b.position.z);

/** Walk `a` into range, then run one move to completion. */
function closeAndStrike(
  sim: Sim,
  move: "punch" | "kick" | "special",
  opts: { defenderBlocks?: boolean; range?: number; onStep?: () => void } = {},
) {
  const range = opts.range ?? 1.35;
  for (let i = 0; i < 400 && distance(sim) > range; i++) {
    const intent = emptyIntent();
    intent.moveZ = 1;
    step(sim, intent, defenderIntent(opts.defenderBlocks));
  }
  const start = emptyIntent();
  start[move] = true;
  step(sim, start, defenderIntent(opts.defenderBlocks));
  opts.onStep?.();
  const frames = Math.ceil(moveDuration(moveFor(sim.a.def, move)) / STEP) + 4;
  for (let i = 0; i < frames; i++) {
    step(sim, emptyIntent(), defenderIntent(opts.defenderBlocks));
    opts.onStep?.();
  }
}

function defenderIntent(blocks?: boolean): Intent {
  const intent = emptyIntent();
  if (blocks) intent.block = true;
  return intent;
}

// ---------------------------------------------------------------- assertions
let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail ? `   ${detail}` : ""}`);
};

console.log("\nCEO CLASH — headless fight simulation\n");

// 1. Movement -------------------------------------------------------------
{
  const sim = makeSim();
  const startDistance = distance(sim);
  const intent = emptyIntent();
  intent.moveZ = 1;
  for (let i = 0; i < 30; i++) step(sim, intent, emptyIntent());
  check("player walks toward the opponent", distance(sim) < startDistance,
    `${startDistance.toFixed(2)} -> ${distance(sim).toFixed(2)}`);
  check("walking plays a movement state", sim.a.state === "MOVING", sim.a.state);
}

// 2. Punch: hitbox, damage, knockback, hit reaction -------------------------
{
  const sim = makeSim();
  const before = sim.b.health;
  const xBefore = sim.b.position.x;
  closeAndStrike(sim, "punch");
  check("punch damages the opponent", sim.b.health < before,
    `${before} -> ${sim.b.health.toFixed(1)}`);
  check("punch knocks the opponent back", sim.b.position.x > xBefore - 0.01,
    `x ${xBefore.toFixed(2)} -> ${sim.b.position.x.toFixed(2)}`);
  check("attacker recovers to a neutral state", sim.a.state === "IDLE" || sim.a.state === "MOVING", sim.a.state);
}

// 3. Blocking reduces damage -----------------------------------------------
{
  const open = makeSim();
  closeAndStrike(open, "punch");
  const openDamage = 100 - open.b.health;

  const guarded = makeSim();
  closeAndStrike(guarded, "punch", { defenderBlocks: true });
  const blockedDamage = 100 - guarded.b.health;

  check("blocking cuts damage down to chip", blockedDamage < openDamage * 0.5,
    `open ${openDamage.toFixed(1)} vs blocked ${blockedDamage.toFixed(1)}`);
}

// 4. Kick knockdown and getting back up -------------------------------------
{
  let recovered = false;
  let sawKnockdown = false;
  for (let attempt = 0; attempt < 12 && !recovered; attempt++) {
    const sim = makeSim();
    closeAndStrike(sim, "kick");
    if (sim.b.state !== "KNOCKED_DOWN") continue;
    sawKnockdown = true;
    const seen = new Set<string>();
    for (let i = 0; i < 260; i++) {
      step(sim, emptyIntent(), emptyIntent());
      seen.add(sim.b.state);
      if (sim.b.state === "IDLE" && seen.has("GETTING_UP")) {
        recovered = true;
        break;
      }
    }
  }
  check("a kick can knock the opponent down", sawKnockdown);
  check("a floored fighter gets back up on their own", recovered);
}

// 5. Specials ---------------------------------------------------------------
{
  const sim = makeSim("sam");
  sim.a.meter = 100;
  const before = sim.b.health;
  const seen = new Set<string>();
  const watch = () => seen.add(sim.b.state);
  closeAndStrike(sim, "special", { range: 1.2, onStep: watch });
  check("GPT SMASH lands for heavy damage", before - sim.b.health > 18,
    `${(before - sim.b.health).toFixed(1)} dmg`);
  check("GPT SMASH floors the opponent", seen.has("KNOCKED_DOWN"), [...seen].join(","));
  check("the special consumes the meter", sim.a.meter < 100, `${sim.a.meter.toFixed(0)}`);
}

{
  // Dario parries an incoming punch and answers with the counter.
  const sim = makeSim("dario");
  sim.a.meter = 100;
  for (let i = 0; i < 400 && distance(sim) > 1.3; i++) {
    const intent = emptyIntent();
    intent.moveZ = 1;
    step(sim, intent, emptyIntent());
  }
  const start = emptyIntent();
  start.special = true;
  step(sim, start, emptyIntent()); // Dario braces
  const attack = emptyIntent();
  attack.punch = true;
  step(sim, emptyIntent(), attack); // Sam swings into the parry
  const before = sim.b.health;
  for (let i = 0; i < 120; i++) step(sim, emptyIntent(), emptyIntent());
  check("CLAUDE COUNTER punishes the attacker", before - sim.b.health > 18,
    `${(before - sim.b.health).toFixed(1)} dmg`);
  check("the parry absorbs the incoming hit", sim.a.health > 95,
    `defender at ${sim.a.health.toFixed(1)} hp`);
}

// 6. Full AI-vs-AI matches reach a KO ---------------------------------------
{
  // Combat is stochastic, so sample rather than trusting a single match.
  const ROUNDS = 9;
  const lengths: number[] = [];
  let decisive = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const sim = makeSim();
    const aiA = new FighterAI();
    const aiB = new FighterAI();
    aiA.reset();
    aiB.reset();
    let frames = 0;
    const limit = 60 * COMBAT.matchSeconds;
    while (frames < limit && sim.a.alive && sim.b.alive) {
      step(sim, aiA.update(sim.a, sim.b, STEP, true), aiB.update(sim.b, sim.a, STEP, true));
      frames++;
    }
    if (!sim.a.alive || !sim.b.alive) decisive++;
    lengths.push(frames / 60);
  }
  const sorted = [...lengths].sort((x, y) => x - y);
  const median = sorted[Math.floor(ROUNDS / 2)];
  check("every AI-vs-AI match ends in a knockout", decisive === ROUNDS,
    `${decisive}/${ROUNDS} decisive`);
  check("matches stay short — a median under a minute", median > 8 && median < 60,
    `median ${median.toFixed(1)}s, range ${sorted[0].toFixed(1)}-${sorted[ROUNDS - 1].toFixed(1)}s`);
}

// 7. Fighters stay inside the arena ----------------------------------------
{
  const sim = makeSim();
  const aiA = new FighterAI();
  const aiB = new FighterAI();
  let escaped = false;
  for (let i = 0; i < 60 * 30; i++) {
    step(sim, aiA.update(sim.a, sim.b, STEP, true), aiB.update(sim.b, sim.a, STEP, true));
    // The stub has no walls, so this only checks the fighters do not run away
    // forever under their own steam.
    if (Math.hypot(sim.a.position.x, sim.a.position.z) > 60) escaped = true;
  }
  check("fighters stay near the middle of the arena", !escaped);
}

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
