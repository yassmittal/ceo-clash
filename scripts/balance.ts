/**
 * Balance harness.
 *
 * Runs whole matches headlessly and reports who wins, how long fights last, and
 * how close they are. Two match-ups:
 *
 *   ai      — Sam's AI vs Dario's AI, to check neither character dominates
 *   human   — a scripted player vs the AI, at a given skill level, to check the
 *             opponent is beatable but not a pushover
 *
 *   bun run balance            # both, default settings
 *   bun run balance human 0.4  # casual player
 *
 * `skill` is 0..1: the probability the scripted player reacts to an incoming
 * attack and the probability it punishes a recovery. 1 is frame-perfect and
 * omniscient, which no real player is — treat it as the ceiling, not the target.
 */
import * as THREE from "three";
import { CHARACTERS } from "../src/characters/index.ts";
import { FighterRuntime, fight } from "../src/game/runtime.ts";
import { updateFighter } from "../src/game/FighterController.ts";
import { updateCombat } from "../src/combat/CombatSystem.ts";
import { FighterAI } from "../src/ai/FighterAI.ts";
import { COMBAT } from "../src/combat/moves.ts";
import { emptyIntent, type FighterId, type Intent } from "../src/game/types.ts";

const STEP = 1 / 60;
const MATCHES = 40;

class StubBody {
  t = { x: 0, y: 0.9, z: 0 };
  v = { x: 0, y: 0, z: 0 };
  translation() { return this.t; }
  linvel() { return this.v; }
  setTranslation(t: { x: number; y: number; z: number }) { this.t = { ...t }; }
  setLinvel(v: { x: number; y: number; z: number }) { this.v = { ...v }; }
  step(dt: number) { this.t.x += this.v.x * dt; this.t.z += this.v.z * dt; this.t.y = 0.9; }
}

interface HumanMemory { react: number; block: number; cooldown: number }

/** A plausible player: reacts late, blocks in bursts, punishes what it notices. */
function scriptedPlayer(
  self: FighterRuntime,
  foe: FighterRuntime,
  mem: HumanMemory,
  dt: number,
  skill: number,
): Intent {
  const intent = emptyIntent();
  mem.react -= dt;
  mem.cooldown -= dt;
  if (!self.canAct()) return intent;

  const distance = Math.hypot(foe.position.x - self.position.x, foe.position.z - self.position.z);
  const incoming =
    foe.state === "ATTACKING" &&
    (foe.attackPhase() === "startup" || foe.attackPhase() === "active") &&
    distance < 2.4;

  if (incoming && mem.react <= 0 && Math.random() < skill) {
    mem.react = 0.22 / skill;
    mem.block = 0.32;
  }
  if (mem.block > 0) {
    mem.block -= dt;
    intent.block = true;
    return intent;
  }
  if (distance > 1.5) {
    intent.moveZ = 1;
    return intent;
  }
  if (mem.cooldown > 0) return intent;
  if (self.specialReady && Math.random() < 0.4) {
    intent.special = true;
    mem.cooldown = 0.9;
    return intent;
  }
  const punishing =
    foe.state === "ATTACKING" && foe.attackPhase() === "recovery" && Math.random() < skill;
  if (punishing || Math.random() < 0.25) {
    if (Math.random() < 0.75) intent.punch = true;
    else intent.kick = true;
    mem.cooldown = 0.35;
  }
  return intent;
}

function runMatch(
  leftId: FighterId,
  rightId: FighterId,
  driveLeft: (self: FighterRuntime, foe: FighterRuntime, dt: number) => Intent,
  driveRight: (self: FighterRuntime, foe: FighterRuntime, dt: number) => Intent,
) {
  const a = new FighterRuntime(CHARACTERS[leftId], "player");
  const b = new FighterRuntime(CHARACTERS[rightId], "opponent");
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

  let frames = 0;
  const limit = 60 * COMBAT.matchSeconds;
  while (frames < limit && a.alive && b.alive) {
    a.position.set(bodyA.t.x, bodyA.t.y, bodyA.t.z);
    b.position.set(bodyB.t.x, bodyB.t.y, bodyB.t.z);
    updateFighter(a, b, driveLeft(a, b, STEP), STEP, true);
    updateFighter(b, a, driveRight(b, a, STEP), STEP, true);
    updateCombat(STEP, a, b);
    bodyA.setLinvel({ x: a.velocity.x, y: 0, z: a.velocity.z });
    bodyB.setLinvel({ x: b.velocity.x, y: 0, z: b.velocity.z });
    bodyA.step(STEP);
    bodyB.step(STEP);
    const dx = b.position.x - a.position.x;
    const dz = b.position.z - a.position.z;
    const d = Math.hypot(dx, dz);
    const min = COMBAT.bodyRadius * 2;
    if (d < min && d > 1e-5) {
      const push = (min - d) / 2;
      bodyA.t.x -= (dx / d) * push;
      bodyA.t.z -= (dz / d) * push;
      bodyB.t.x += (dx / d) * push;
      bodyB.t.z += (dz / d) * push;
    }
    frames++;
  }
  return { seconds: frames / 60, leftHp: a.health, rightHp: b.health };
}

const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)];
const mean = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / (xs.length || 1);

function aiVsAi() {
  let sam = 0;
  let dario = 0;
  let draws = 0;
  const times: number[] = [];
  for (let i = 0; i < MATCHES; i++) {
    const left = new FighterAI();
    const right = new FighterAI();
    left.reset();
    right.reset();
    const r = runMatch(
      "sam",
      "dario",
      (s, f, dt) => left.update(s, f, dt, true),
      (s, f, dt) => right.update(s, f, dt, true),
    );
    times.push(r.seconds);
    if (r.leftHp <= 0 && r.rightHp <= 0) draws++;
    else if (r.rightHp <= 0) sam++;
    else if (r.leftHp <= 0) dario++;
    else draws++;
  }
  console.log(`\nAI vs AI  (${MATCHES} matches)`);
  console.log(`  sam ${sam} · dario ${dario} · undecided ${draws}`);
  console.log(
    `  length: median ${median(times).toFixed(1)}s  range ${Math.min(...times).toFixed(1)}-${Math.max(...times).toFixed(1)}s`,
  );
}

function humanVsAi(skill: number) {
  let wins = 0;
  let losses = 0;
  const hpOnWin: number[] = [];
  const times: number[] = [];
  for (let i = 0; i < MATCHES; i++) {
    const ai = new FighterAI();
    ai.reset();
    const mem: HumanMemory = { react: 0, block: 0, cooldown: 0 };
    const r = runMatch(
      "sam",
      "dario",
      (s, f, dt) => scriptedPlayer(s, f, mem, dt, skill),
      (s, f, dt) => ai.update(s, f, dt, true),
    );
    times.push(r.seconds);
    if (r.rightHp <= 0) {
      wins++;
      hpOnWin.push(r.leftHp);
    } else losses++;
  }
  console.log(`\nScripted player (skill ${skill}) vs AI  (${MATCHES} matches)`);
  console.log(`  player ${wins} · ai ${losses}   (${((wins / MATCHES) * 100).toFixed(0)}% win rate)`);
  console.log(
    `  average hp left on a win: ${mean(hpOnWin).toFixed(0)}   median length ${median(times).toFixed(1)}s`,
  );
}

const mode = process.argv[2] ?? "all";
if (mode === "all" || mode === "ai") aiVsAi();
if (mode === "all") {
  for (const skill of [1, 0.6, 0.35]) humanVsAi(skill);
} else if (mode === "human") {
  humanVsAi(Number(process.argv[3] ?? 0.6));
}
console.log("");
