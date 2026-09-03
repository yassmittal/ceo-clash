import * as THREE from "three";
import type { MoveDef } from "@/game/types";
import { COMBAT } from "./moves";
import { addTrauma, fight, type FighterRuntime } from "@/game/runtime";
import { spawnBurst } from "@/effects/effectsBus";
import { audio } from "@/audio/AudioManager";
import { useGameStore } from "@/state/gameStore";
import {
  bigHitLine,
  blockLine,
  counterLine,
  knockdownLine,
  specialLine,
} from "@/game/brainrot";

/**
 * COMBAT STATE — hitboxes, damage, knockback.
 *
 * The rule the plan sets out, implemented literally:
 *
 *   attack starts -> animation plays -> hitbox exists ONLY during the active
 *   frames -> test it against the opponent's hurtbox -> on overlap deal damage,
 *   apply knockback, interrupt them into a hit reaction, play a sound, spawn
 *   particles and shake the camera.
 *
 * There is no per-bone collision. A moving sphere in front of the chest against
 * a standing capsule is enough, and it is deterministic and tunable, which is
 * what a fighting game actually needs.
 */

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

/** Feet position: the rigid body's origin sits at the capsule's centre. */
export const groundY = (f: FighterRuntime) => f.position.y - 0.9;

/** Where this frame's hitbox is, in world space. */
export function hitboxCenter(f: FighterRuntime, move: MoveDef, out = new THREE.Vector3()) {
  f.forward(tmpDir);
  return out.set(
    f.position.x + tmpDir.x * move.reach,
    groundY(f) + move.height,
    f.position.z + tmpDir.z * move.reach,
  );
}

/** Distance from a point to the defender's vertical hurtbox capsule. */
function distanceToHurtbox(point: THREE.Vector3, defender: FighterRuntime) {
  const base = groundY(defender);
  const low = base + COMBAT.hurtboxLow;
  const high = base + COMBAT.hurtboxHigh;
  const y = THREE.MathUtils.clamp(point.y, low, high);
  tmpB.set(defender.position.x, y, defender.position.z);
  return point.distanceTo(tmpB) - COMBAT.hurtboxRadius;
}

export function overlaps(attacker: FighterRuntime, defender: FighterRuntime, move: MoveDef) {
  hitboxCenter(attacker, move, tmpA);
  return distanceToHurtbox(tmpA, defender) <= move.radius;
}

function facingEachOther(defender: FighterRuntime, attacker: FighterRuntime) {
  tmpDir.subVectors(attacker.position, defender.position).setY(0).normalize();
  const fwd = defender.forward(tmpB);
  return fwd.dot(tmpDir) >= COMBAT.blockArcCos;
}

export interface HitResult {
  blocked: boolean;
  knockdown: boolean;
  damage: number;
}

/**
 * Applies a landed hit. Called both by the normal active-frame test and by the
 * guaranteed counter-attack, which is why it is separate from the detection.
 */
export function applyHit(
  attacker: FighterRuntime,
  defender: FighterRuntime,
  move: MoveDef,
  opts: { guaranteed?: boolean } = {},
): HitResult {
  const store = useGameStore.getState();

  const blocked =
    !opts.guaranteed &&
    defender.blocking &&
    defender.state === "BLOCKING" &&
    facingEachOther(defender, attacker);

  let damage = move.damage * attacker.tuning.damageOut * defender.tuning.damageIn;

  const contact = hitboxCenter(attacker, move, tmpA);
  tmpDir.subVectors(defender.position, attacker.position).setY(0);
  if (tmpDir.lengthSq() < 1e-6) attacker.forward(tmpDir);
  tmpDir.normalize();

  if (blocked) {
    // A guard only stops light attacks. Heavy ones smash through it, which is
    // what stops "hold block" from being the whole game.
    const broken = move.guardBreak;
    damage *= broken ? COMBAT.guardBreakMultiplier : COMBAT.chipMultiplier;
    defender.health = Math.max(0, defender.health - damage);
    defender.hitstun = broken ? COMBAT.guardBreakStun : COMBAT.blockStun;
    defender.knockback
      .copy(tmpDir)
      .multiplyScalar(move.knockback * (broken ? 0.9 : COMBAT.blockKnockbackMultiplier));
    defender.addMeter(damage * COMBAT.meterPerDamageTaken * 2);
    attacker.addMeter(move.meterGain * (broken ? 0.8 : 0.4));

    if (broken) {
      // Guard broken: dropped out of the block and open to a follow-up.
      defender.blocking = false;
      defender.flash = 0.18;
      defender.setState("HIT", COMBAT.guardBreakStun, true);
      attacker.combo += 1;
      audio.heavy();
      spawnBurst("heavy", contact, 1.2);
      addTrauma(move.screenShake * 0.8);
      fight.hitstop = Math.max(fight.hitstop, move.hitstop);
      store.announce("GUARD BROKEN", "big");
    } else {
      audio.block();
      spawnBurst("block", contact, 0.6);
      addTrauma(move.screenShake * 0.35);
      fight.hitstop = Math.max(fight.hitstop, move.hitstop * 0.6);
      if (Math.random() < 0.35) store.announce(blockLine(), "info");
    }
    return { blocked: true, knockdown: false, damage };
  }

  // A counter-hit — landing while they were mid-attack — always floors them.
  const counterHit =
    defender.state === "ATTACKING" &&
    (defender.attackPhase() === "startup" || defender.attackPhase() === "active");

  defender.health = Math.max(0, defender.health - damage);
  defender.flash = 0.2;
  defender.blocking = false;
  defender.parrying = false;
  defender.combo = 0;
  attacker.combo += 1;

  const lethal = defender.health <= 0;
  const knockdown =
    move.knockdown ||
    lethal ||
    (move.id === "kick" && (counterHit || Math.random() < COMBAT.kickKnockdownChance));

  const power = knockdown ? 1.35 : 1;
  defender.knockback.copy(tmpDir).multiplyScalar(move.knockback * power);
  defender.hitstun = move.hitstun * (knockdown ? 1.1 : 1);

  // Interrupt whatever they were doing. Hit reactions outrank everything except
  // being dead — that is what makes attacks feel like they land.
  if (lethal) {
    defender.setState("KNOCKED_DOWN", COMBAT.knockdownDuration, true);
    defender.combat.move = null;
  } else if (knockdown) {
    defender.setState("KNOCKED_DOWN", COMBAT.knockdownDuration, true);
    defender.combat.move = null;
  } else {
    defender.setState("HIT", move.hitstun, true);
    defender.combat.move = null;
  }

  attacker.addMeter(move.meterGain);
  defender.addMeter(damage * COMBAT.meterPerDamageTaken);

  fight.hitstop = Math.max(fight.hitstop, move.hitstop);
  if (move.slowmo > 0) fight.slowmo = Math.max(fight.slowmo, move.slowmo);
  addTrauma(move.screenShake);

  if (move.id === "special") {
    audio.heavy();
    spawnBurst("special", contact, 2.2);
    store.announce(opts.guaranteed ? counterLine() : specialLine(), "big");
  } else if (knockdown) {
    audio.heavy();
    spawnBurst("heavy", contact, 1.6);
    store.announce(knockdownLine(), "big");
  } else {
    audio.hit(move.id === "kick" ? 1.4 : 1);
    spawnBurst("hit", contact, move.id === "kick" ? 1.2 : 0.9);
    if (attacker.combo >= 3 || Math.random() < 0.18) store.announce(bigHitLine(), "hit");
  }

  if (knockdown) audio.knockdown();

  return { blocked: false, knockdown, damage };
}

/**
 * Per-frame hitbox resolution for one direction of the matchup.
 * `attacker` may only connect once per activation.
 */
function resolve(attacker: FighterRuntime, defender: FighterRuntime) {
  const move = attacker.combat.move;
  if (!move || attacker.attackPhase() !== "active") return;
  if (attacker.combat.connected) return;
  if (move.kind === "counter") return; // counters do not swing during the parry
  if (defender.invuln > 0) return;
  if (defender.state === "KNOCKED_DOWN" || defender.state === "GETTING_UP") return;
  if (!defender.alive) return;
  if (!overlaps(attacker, defender, move)) return;

  attacker.combat.connected = true;

  // A counter-special that is currently parrying eats the hit and answers.
  if (defender.parrying && defender.combat.move?.kind === "counter") {
    absorbIntoCounter(defender, attacker);
    return;
  }

  applyHit(attacker, defender, move);
}

/** The parry succeeded: cancel the incoming damage and schedule the rebuttal. */
function absorbIntoCounter(defender: FighterRuntime, attacker: FighterRuntime) {
  const move = defender.combat.move;
  if (!move) return;
  defender.combat.countered = true;
  defender.parrying = false;
  defender.counterTarget = attacker;
  defender.counterDelay = 0.16;
  // Jump the animation to the rebuttal so the visuals match the timing.
  defender.combat.time = move.startup + move.active - 0.02;
  defender.animator?.play("SPECIAL", { restart: false });
  defender.animator?.seek(0.62);

  fight.hitstop = Math.max(fight.hitstop, 0.14);
  fight.slowmo = Math.max(fight.slowmo, 0.5);
  addTrauma(0.5);
  audio.block();
  spawnBurst("block", hitboxCenter(attacker, move, tmpA), 1.4);
  useGameStore.getState().announce("PARRIED", "big");
}

/** Fires the guaranteed counter hit once its short delay elapses. */
function tickCounter(f: FighterRuntime, dt: number) {
  if (!f.counterTarget) return;
  f.counterDelay -= dt;
  if (f.counterDelay > 0) return;
  const target = f.counterTarget;
  const move = f.combat.move;
  f.counterTarget = null;
  if (!move || !f.alive || !target.alive) return;
  applyHit(f, target, move, { guaranteed: true });
}

export function updateCombat(dt: number, a: FighterRuntime, b: FighterRuntime) {
  resolve(a, b);
  resolve(b, a);
  tickCounter(a, dt);
  tickCounter(b, dt);
}
