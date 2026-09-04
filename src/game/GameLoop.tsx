import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGameStore } from "@/state/gameStore";
import { addTrauma, fight, resetFight, type FighterRuntime } from "@/game/runtime";
import { updateFighter } from "@/game/FighterController";
import { updateCombat } from "@/combat/CombatSystem";
import { FighterAI } from "@/ai/FighterAI";
import { input } from "@/input/InputManager";
import { updateCamera } from "@/game/Camera";
import { COMBAT } from "@/combat/moves";
import { audio } from "@/audio/AudioManager";
import { koLine } from "@/game/brainrot";
import { emptyIntent } from "@/game/types";

/**
 * THE DIRECTOR — one loop, one deterministic order.
 *
 * Every per-frame behaviour in the game happens here, in this sequence:
 *
 *   1. advance the global clock (hitstop / slow motion)
 *   2. read positions out of Rapier
 *   3. gather intents (keyboard for the player, state machine for the AI)
 *   4. run both fighter controllers (state machine -> movement -> animation)
 *   5. resolve hitboxes
 *   6. push velocities back into Rapier and clamp to the arena
 *   7. update the camera and publish a HUD snapshot
 *
 * Keeping it in one place is why hits always register on the frame the animation
 * says they should, instead of a frame late in whichever component ran first.
 */

const HUD_INTERVAL = 1 / 20;

/**
 * How far a fighter may turn their head towards the camera, in radians.
 *
 * The arena camera is always perpendicular to the line between the fighters, so
 * squared up they would be in pure profile — and a profile is the one angle at
 * which a real face is hardest to place. A third of a turn is enough to put the
 * near eye and the shape of the nose on screen without it reading as a fighter
 * who has stopped watching their opponent.
 */
const HEAD_TURN_MAX = 0.58;

export function GameLoop() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const ai = useMemo(() => new FighterAI(), []);
  const hudTimer = useRef(0);
  const countdownTimer = useRef(0);
  const lastCountdown = useRef<number | null>(null);

  useEffect(() => {
    input.attach();
    ai.reset();
    return () => input.detach();
  }, [ai]);

  // Restart the countdown whenever a new match begins.
  const matchKey = useGameStore((s) => s.matchKey);
  useEffect(() => {
    countdownTimer.current = 0;
    lastCountdown.current = null;
    ai.reset();
  }, [matchKey, ai]);

  useFrame((_, delta) => {
    const store = useGameStore.getState();
    const phase = store.phase;
    const raw = Math.min(delta, 1 / 30);

    // --- 1. global time -------------------------------------------------
    let scale = 1;
    if (fight.hitstop > 0) {
      fight.hitstop = Math.max(0, fight.hitstop - raw);
      scale = 0.02; // not quite frozen: a sliver of motion looks alive
    } else if (fight.slowmo > 0) {
      fight.slowmo = Math.max(0, fight.slowmo - raw);
      scale = 0.3;
    }
    fight.timeScale = scale;
    const dt = raw * scale;

    const player = fight.player;
    const opponent = fight.opponent;
    if (!player || !opponent) return;

    // --- 2. read physics ------------------------------------------------
    syncFromBody(player);
    syncFromBody(opponent);

    const fighting = phase === "FIGHTING";

    // Quitting mid-fight: put the arena back to a clean idle, since the menu is
    // drawn over a live scene.
    if (phase === "MENU" || phase === "CHARACTER_SELECT") {
      if (fight.resolved || player.health < 100 || opponent.health < 100) resetFight();
    }

    // --- countdown ------------------------------------------------------
    if (phase === "COUNTDOWN") {
      countdownTimer.current += raw;
      const step = Math.floor(countdownTimer.current);
      const value = Math.max(0, 3 - step);
      if (lastCountdown.current !== value) {
        lastCountdown.current = value;
        store.setCountdown(value);
        audio.beep(value === 0);
      }
      if (countdownTimer.current > 3.75) {
        store.setCountdown(null);
        store.setPhase("FIGHTING");
      }
    }

    // --- 3. intents -----------------------------------------------------
    // Always drain the buffer, even between rounds, so nothing queues up.
    const buffered = input.consume();
    const playerIntent = fighting ? buffered : emptyIntent();
    const aiIntent = ai.update(opponent, player, raw, fighting);

    // --- 4. controllers -------------------------------------------------
    const canAct = fighting;
    updateFighter(player, opponent, playerIntent, dt, canAct);
    updateFighter(opponent, player, aiIntent, dt, canAct);

    // --- 5. combat ------------------------------------------------------
    if (fighting || phase === "KO") updateCombat(dt, player, opponent);

    // --- 6. write physics + arena bounds ---------------------------------
    applyVelocity(player);
    applyVelocity(opponent);
    clampToArena(player);
    clampToArena(opponent);
    applyVisuals(player, camera, dt);
    applyVisuals(opponent, camera, dt);

    // --- match clock ------------------------------------------------------
    if (fighting) {
      fight.clock = Math.max(0, fight.clock - raw);
      if (fight.clock <= 0 && !fight.resolved) resolveTimeout(player, opponent);
    }

    // --- KO ----------------------------------------------------------------
    if (!fight.resolved && (player.health <= 0 || opponent.health <= 0)) {
      const loser = player.health <= 0 ? player : opponent;
      startKo(loser);
    }

    if (fight.resolved && store.phase === "KO") {
      fight.koTimer += raw;
      if (fight.koTimer > 2.1) {
        const winner = player.health <= 0 ? opponent : player;
        winner.setState("VICTORY", 0, true);
        store.declareWinner(winner.side, koLine());
      }
    }

    // --- 7. camera + HUD ---------------------------------------------------
    fight.trauma = Math.max(0, fight.trauma - raw * 1.9);
    updateCamera(camera, raw, { closeUp: phase === "KO" || phase === "WINNER" });

    hudTimer.current += raw;
    if (hudTimer.current >= HUD_INTERVAL) {
      hudTimer.current = 0;
      store.syncHud({
        playerHp: player.health,
        opponentHp: opponent.health,
        playerMeter: player.meter,
        opponentMeter: opponent.meter,
        timer: Math.ceil(fight.clock),
      });
    }

    // Passive meter gain keeps specials in play without farming chip damage.
    if (fighting) {
      player.addMeter(COMBAT.meterPerSecond * raw);
      opponent.addMeter(COMBAT.meterPerSecond * raw);
    }
  });

  return null;
}

const tmpVec = new THREE.Vector3();

function syncFromBody(f: FighterRuntime) {
  const body = f.body;
  if (!body) return;
  const t = body.translation();
  f.position.set(t.x, t.y, t.z);
}

function applyVelocity(f: FighterRuntime) {
  const body = f.body;
  if (!body) return;
  const current = body.linvel();
  body.setLinvel({ x: f.velocity.x, y: current.y, z: f.velocity.z }, true);
}

/**
 * Rapier's octagon walls do the real work, but a radial clamp guarantees nobody
 * can be knocked through a corner by a big special.
 */
function clampToArena(f: FighterRuntime) {
  const body = f.body;
  if (!body) return;
  const limit = COMBAT.arenaRadius - COMBAT.bodyRadius - 0.15;
  const r = Math.hypot(f.position.x, f.position.z);
  if (r <= limit) return;
  const scale = limit / r;
  const x = f.position.x * scale;
  const z = f.position.z * scale;
  f.position.set(x, f.position.y, z);
  body.setTranslation({ x, y: f.position.y, z }, true);
  // Kill the outward component of the knockback so they do not stick to the wall.
  tmpVec.set(x, 0, z).normalize();
  const outward = f.knockback.dot(tmpVec);
  if (outward > 0) f.knockback.addScaledVector(tmpVec, -outward);
}

/** Facing rotation, the head's turn towards camera, and the white flash on hit. */
function applyVisuals(f: FighterRuntime, camera: THREE.Camera, dt: number) {
  // `facing` is already smoothed by the controller's turn rate.
  if (f.visual) f.visual.rotation.y = f.facing;

  // The head models are the one part of a fighter with a front, so it is worth
  // pointing it at the audience. This runs after updateFighter has stepped the
  // mixer, and adds to whatever rotation the clip just wrote — every clip poses
  // the Head bone, so the addition is refreshed each frame rather than winding
  // up. Fighters on the floor keep whatever the knockdown clip gave them.
  const head = f.rigHead;
  if (head) {
    const upright =
      f.state !== "KNOCKED_DOWN" && f.state !== "GETTING_UP" && f.state !== "DEFEATED";
    let goal = 0;
    if (upright) {
      const toCamera = Math.atan2(
        camera.position.x - f.position.x,
        camera.position.z - f.position.z,
      );
      // Shortest way round, so crossing over does not spin the head the long way.
      const delta = Math.atan2(
        Math.sin(toCamera - f.facing),
        Math.cos(toCamera - f.facing),
      );
      goal = THREE.MathUtils.clamp(delta, -HEAD_TURN_MAX, HEAD_TURN_MAX);
    }
    f.headTurn = THREE.MathUtils.lerp(f.headTurn, goal, 1 - Math.exp(-6 * dt));
    head.rotation.y += f.headTurn;
  }

  const materials = f.rigMaterials;
  if (materials) {
    const intensity = f.flash > 0 ? f.flash * 4 : 0;
    for (const m of materials) {
      const base = m.userData.baseEmissive as THREE.Color | undefined;
      if (base) m.emissive.copy(base).addScalar(intensity);
      else m.emissive.setRGB(intensity, intensity, intensity);
    }
  }
}

function startKo(loser: FighterRuntime) {
  fight.resolved = true;
  fight.koTimer = 0;
  fight.slowmo = Math.max(fight.slowmo, 1.4);
  addTrauma(1);
  audio.ko();
  const store = useGameStore.getState();
  store.setPhase("KO");
  store.announce("K.O.", "big");
  loser.setState("KNOCKED_DOWN", 999, true);
}

/** Time ran out: whoever has more health takes it. */
function resolveTimeout(player: FighterRuntime, opponent: FighterRuntime) {
  fight.resolved = true;
  fight.koTimer = 0;
  const store = useGameStore.getState();
  const winner =
    player.health === opponent.health
      ? player // draws go to the player; this is a party game
      : player.health > opponent.health
        ? player
        : opponent;
  const loser = winner === player ? opponent : player;
  loser.setState("DEFEATED", 999, true);
  audio.ko();
  store.setPhase("KO");
  store.announce("TIME", "big");
}
