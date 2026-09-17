/**
 * Balance harness.
 *
 * Runs whole matches headlessly and reports who wins, how long fights last, and
 * how close they are. Two match-ups:
 *
 *   ai      — a round-robin of AI vs AI over every pair in the roster, to check
 *             no fighter or pairing dominates
 *   human   — a scripted player vs each fighter's AI, at a given skill level, to
 *             check the opponent is beatable but not a pushover
 *
 *   bun run balance              # both, default settings
 *   bun run balance ai 400       # round-robin only, 400 matches a pairing
 *   bun run balance human 0.4    # casual player
 *
 * The round-robin exits non-zero when a pairing lands outside 35-65% or a
 * fighter wins more than 60% of its matches overall.
 *
 * `skill` is 0..1: the probability the scripted player reacts to an incoming
 * attack and the probability it punishes a recovery. 1 is frame-perfect and
 * omniscient, which no real player is — treat it as the ceiling, not the target.
 */
import * as THREE from "three";
import { CHARACTERS, FIGHTER_IDS } from "../src/characters/index.ts";
import { FighterRuntime, fight } from "../src/game/runtime.ts";
import { updateFighter } from "../src/game/FighterController.ts";
import { updateCombat } from "../src/combat/CombatSystem.ts";
import { FighterAI } from "../src/ai/FighterAI.ts";
import { COMBAT } from "../src/combat/moves.ts";
import { emptyIntent, type FighterId, type Intent } from "../src/game/types.ts";

const STEP = 1 / 60;
const MATCHES = 40;
/**
 * The round-robin needs far more than 40 a pairing to mean anything: at 40 the
 * standard error on a 50% win rate is ~8 points, so a perfectly even pairing
 * trips the 35-65% gate every few runs. 200 puts it at ~3.5, and the whole
 * sweep still runs in a few seconds.
 */
const ROUND_ROBIN_MATCHES = 200;

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

const pct = (n: number, of: number) => `${((n / (of || 1)) * 100).toFixed(0)}%`.padStart(4);

function aiVsAi(matches: number): boolean {
  const ids = [...FIGHTER_IDS];
  // wins[a][b] = matches a won against b.
  const wins = new Map(ids.map((a) => [a, new Map(ids.map((b) => [b, 0]))]));
  const played = new Map(ids.map((a) => [a, 0]));
  const won = new Map(ids.map((a) => [a, 0]));
  const times: number[] = [];
  let undecided = 0;
  let ok = true;

  console.log(`\nAI vs AI round-robin  (${matches} matches a pairing)`);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [x, y] = [ids[i], ids[j]];
      let xWins = 0;
      let yWins = 0;
      const pairTimes: number[] = [];
      for (let m = 0; m < matches; m++) {
        // Alternate sides, in case being "player" or "opponent" ever matters.
        const [left, right] = m % 2 === 0 ? [x, y] : [y, x];
        const aiL = new FighterAI();
        const aiR = new FighterAI();
        aiL.reset();
        aiR.reset();
        const r = runMatch(
          left,
          right,
          (s, f, dt) => aiL.update(s, f, dt, true),
          (s, f, dt) => aiR.update(s, f, dt, true),
        );
        pairTimes.push(r.seconds);
        const leftWon = r.rightHp <= 0 && r.leftHp > 0;
        const rightWon = r.leftHp <= 0 && r.rightHp > 0;
        if (!leftWon && !rightWon) {
          undecided++;
          continue;
        }
        if ((leftWon ? left : right) === x) xWins++;
        else yWins++;
      }
      wins.get(x)!.set(y, xWins);
      wins.get(y)!.set(x, yWins);
      const decided = xWins + yWins;
      played.set(x, played.get(x)! + decided);
      played.set(y, played.get(y)! + decided);
      won.set(x, won.get(x)! + xWins);
      won.set(y, won.get(y)! + yWins);
      times.push(...pairTimes);

      const rate = xWins / (decided || 1);
      const flag = rate < 0.35 || rate > 0.65 ? "  <- OUTSIDE 35-65%" : rate < 0.4 || rate > 0.6 ? "  (outside 40-60)" : "";
      if (rate < 0.35 || rate > 0.65) ok = false;
      console.log(
        `  ${x.padEnd(6)} ${String(xWins).padStart(3)} - ${String(yWins).padEnd(3)} ${y.padEnd(6)}` +
          `  ${pct(xWins, decided)}   median ${median(pairTimes).toFixed(1)}s` +
          `  range ${Math.min(...pairTimes).toFixed(1)}-${Math.max(...pairTimes).toFixed(1)}s${flag}`,
      );
    }
  }

  // The matrix: row fighter's win rate against the column fighter.
  console.log(`\n  win rate (row vs column)`);
  console.log(`  ${"".padEnd(7)}${ids.map((c) => c.padStart(6)).join("")}   overall`);
  for (const r of ids) {
    const cells = ids.map((c) => {
      if (c === r) return "     -";
      const w = wins.get(r)!.get(c)!;
      const l = wins.get(c)!.get(r)!;
      return pct(w, w + l).padStart(6);
    });
    const overall = won.get(r)! / (played.get(r)! || 1);
    if (overall > 0.6) ok = false;
    console.log(`  ${r.padEnd(7)}${cells.join("")}   ${pct(won.get(r)!, played.get(r)!)}${overall > 0.6 ? "  <- OVER 60%" : ""}`);
  }
  console.log(
    `\n  length: median ${median(times).toFixed(1)}s  range ${Math.min(...times).toFixed(1)}-${Math.max(...times).toFixed(1)}s` +
      `  · undecided ${undecided}`,
  );
  console.log(`  ${ok ? "balance thresholds met" : "BALANCE THRESHOLDS NOT MET"}`);
  return ok;
}

function humanVsAi(skill: number) {
  let wins = 0;
  let losses = 0;
  const hpOnWin: number[] = [];
  const times: number[] = [];
  const ids = [...FIGHTER_IDS];
  for (let i = 0; i < MATCHES; i++) {
    const ai = new FighterAI();
    ai.reset();
    const mem: HumanMemory = { react: 0, block: 0, cooldown: 0 };
    // Cycle through every pairing, so the rate is against the roster rather
    // than against one fighter.
    const human = ids[i % ids.length];
    const cpu = ids[(i + 1 + (Math.floor(i / ids.length) % (ids.length - 1))) % ids.length];
    const r = runMatch(
      human,
      cpu,
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
let balanced = true;
if (mode === "all") balanced = aiVsAi(ROUND_ROBIN_MATCHES);
else if (mode === "ai") balanced = aiVsAi(Number(process.argv[3] ?? ROUND_ROBIN_MATCHES));
if (mode === "all") {
  for (const skill of [1, 0.6, 0.35]) humanVsAi(skill);
} else if (mode === "human") {
  humanVsAi(Number(process.argv[3] ?? 0.6));
}
console.log("");
process.exit(balanced ? 0 : 1);
