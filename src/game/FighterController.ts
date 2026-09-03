import * as THREE from "three";
import type { AnimState, Intent } from "@/game/types";
import { COMBAT, moveDuration, moveFor, specialFor } from "@/combat/moves";
import { type FighterRuntime } from "@/game/runtime";
import { audio } from "@/audio/AudioManager";

/**
 * The pipeline the plan asks for, in order:
 *
 *   Input -> Player Controller -> Movement -> Character State -> Animation
 *
 * The same function drives the player and the AI; only the source of the Intent
 * differs. That means the AI can never do anything a human could not, and both
 * are subject to the same recovery frames.
 */

const tmp = new THREE.Vector3();
const desired = new THREE.Vector3();

/** Shortest-path angle lerp, so fighters never spin the long way around. */
function turnToward(current: number, target: number, maxDelta: number) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + THREE.MathUtils.clamp(diff, -maxDelta, maxDelta);
}

export function updateFighter(
  f: FighterRuntime,
  opponent: FighterRuntime,
  intent: Intent,
  dt: number,
  canFight: boolean,
) {
  f.intent = intent;
  f.stateTime += dt;
  if (f.hitstun > 0) f.hitstun = Math.max(0, f.hitstun - dt);
  if (f.invuln > 0) f.invuln = Math.max(0, f.invuln - dt);
  if (f.flash > 0) f.flash = Math.max(0, f.flash - dt);

  // --- face the opponent ------------------------------------------------
  const grounded = f.state !== "KNOCKED_DOWN" && f.state !== "DEFEATED";
  if (grounded) {
    tmp.subVectors(opponent.position, f.position);
    if (tmp.lengthSq() > 1e-4) {
      const target = Math.atan2(tmp.x, tmp.z);
      f.facing = turnToward(f.facing, target, f.tuning.turnSpeed * dt);
    }
  }

  // --- state machine ----------------------------------------------------
  advanceState(f, intent, dt, canFight);

  // --- movement ---------------------------------------------------------
  computeVelocity(f, dt, canFight);

  // --- animation (a pure view of the state above) ------------------------
  syncAnimation(f, dt);
}

function advanceState(f: FighterRuntime, intent: Intent, dt: number, canFight: boolean) {
  if (f.state === "DEFEATED" || f.state === "VICTORY") return;

  if (!f.alive) {
    // Death is handled by the KO sequence; the controller just stops driving.
    if (f.state !== "KNOCKED_DOWN") f.setState("KNOCKED_DOWN", COMBAT.knockdownDuration, true);
    return;
  }

  switch (f.state) {
    case "KNOCKED_DOWN":
      if (f.stateTime >= f.stateLock) {
        f.setState("GETTING_UP", f.tuning.getUpTime, true);
        f.invuln = f.tuning.getUpTime * 0.9;
      }
      return;

    case "GETTING_UP":
      if (f.stateTime >= f.stateLock) f.setState("IDLE");
      return;

    case "HIT":
      if (f.hitstun <= 0) f.setState("IDLE");
      return;

    case "ATTACKING": {
      const move = f.combat.move;
      if (!move) {
        f.setState("IDLE");
        return;
      }
      f.combat.time += dt;
      // A counter-special is "parrying" for the whole of its active window.
      f.parrying =
        move.kind === "counter" &&
        !f.combat.countered &&
        f.combat.time >= move.startup &&
        f.combat.time < move.startup + move.active;
      if (f.combat.time >= moveDuration(move)) {
        f.combat.move = null;
        f.parrying = false;
        f.setState("IDLE");
      }
      return;
    }

    default:
      break;
  }

  // --- free to act ------------------------------------------------------
  f.parrying = false;
  if (!canFight) {
    f.blocking = false;
    f.setState("IDLE");
    return;
  }

  if (intent.special && f.specialReady) {
    const move = specialFor(f.def);
    f.meter = 0;
    f.startMove(move);
    audio.special();
    return;
  }
  if (intent.punch) {
    f.startMove(moveFor(f.def, "punch"));
    audio.whoosh();
    return;
  }
  if (intent.kick) {
    f.startMove(moveFor(f.def, "kick"));
    audio.whoosh();
    return;
  }
  if (intent.block) {
    f.blocking = true;
    f.setState("BLOCKING");
    return;
  }

  f.blocking = false;
  const moving = Math.abs(intent.moveX) > 0.01 || Math.abs(intent.moveZ) > 0.01;
  f.setState(moving ? "MOVING" : "IDLE");
}

function computeVelocity(f: FighterRuntime, dt: number, canFight: boolean) {
  desired.set(0, 0, 0);

  if (canFight && f.alive) {
    if (f.state === "MOVING" || f.state === "IDLE") {
      const intent = f.intent;
      const mag = Math.min(1, Math.hypot(intent.moveX, intent.moveZ));
      if (mag > 0.01) {
        // Backing off is slower than closing in — it keeps fights moving forward.
        const retreating = intent.moveZ < -0.01;
        const speed = retreating
          ? f.tuning.walkSpeed * 0.8
          : mag > 0.85
            ? f.tuning.runSpeed
            : f.tuning.walkSpeed;
        f.forward(tmp).multiplyScalar(intent.moveZ);
        desired.add(tmp);
        f.right(tmp).multiplyScalar(intent.moveX);
        desired.add(tmp);
        if (desired.lengthSq() > 0) desired.normalize().multiplyScalar(speed);
      }
    } else if (f.state === "BLOCKING") {
      // You may shuffle backwards while blocking, nothing more.
      const back = Math.min(0, f.intent.moveZ);
      f.forward(tmp).multiplyScalar(back * f.tuning.walkSpeed * 0.5);
      desired.add(tmp);
    } else if (f.state === "ATTACKING" && f.combat.move) {
      // Attacks carry the fighter forward during startup + active frames.
      const move = f.combat.move;
      const t = f.combat.time;
      const window = move.startup + move.active;
      if (t < window) {
        const curve = Math.sin((t / window) * Math.PI);
        f.forward(tmp).multiplyScalar(move.lunge * curve);
        desired.add(tmp);
      }
    }
  }

  // Knockback decays exponentially and is added on top of intentional movement.
  if (f.knockback.lengthSq() > 1e-5) {
    const decay = Math.exp(-COMBAT.knockbackDamping * dt);
    f.knockback.multiplyScalar(decay);
    if (f.knockback.lengthSq() < 1e-4) f.knockback.set(0, 0, 0);
    desired.add(f.knockback);
  }

  f.velocity.copy(desired);
}

/**
 * ANIMATION STATE — derived, never authored.
 *
 * Every frame this collapses (fighter state + combat state) into exactly one
 * clip. Because it is a pure function of gameplay state, the animation can never
 * drift out of sync with what the combat system thinks is happening.
 */
function syncAnimation(f: FighterRuntime, dt: number) {
  const anim = f.animator;
  if (!anim) return;

  let state: AnimState = "IDLE";
  let timeScale = 1;

  switch (f.state) {
    case "DEFEATED":
      state = "DEFEAT";
      break;
    case "VICTORY":
      state = "VICTORY";
      break;
    case "KNOCKED_DOWN":
      state = "KNOCKDOWN";
      break;
    case "GETTING_UP":
      state = "GET_UP";
      // Stretch or squash the clip to exactly fill the get-up window.
      timeScale = 1.05 / f.tuning.getUpTime;
      break;
    case "HIT":
      state = "HIT";
      break;
    case "BLOCKING":
      state = "BLOCK";
      break;
    case "ATTACKING":
      state = f.combat.move?.anim ?? "PUNCH";
      break;
    case "MOVING": {
      const speed = Math.hypot(f.velocity.x, f.velocity.z);
      const running = speed > f.tuning.walkSpeed * 1.15;
      state = running ? "RUN" : "WALK";
      // Walking backwards plays the cycle in reverse. Cheap, reads correctly.
      const backwards = f.intent.moveZ < -0.01 && Math.abs(f.intent.moveZ) > Math.abs(f.intent.moveX);
      const rate = THREE.MathUtils.clamp(speed / (running ? f.tuning.runSpeed : f.tuning.walkSpeed), 0.35, 1.6);
      timeScale = backwards ? -rate : rate;
      break;
    }
    default:
      state = "IDLE";
  }

  const restart = f.animRestart;
  f.animRestart = false;
  anim.play(state, {
    restart,
    timeScale,
    fade: restart ? (state === "HIT" || state === "KNOCKDOWN" ? 0.05 : 0.08) : 0.14,
  });
  anim.update(dt);
}
