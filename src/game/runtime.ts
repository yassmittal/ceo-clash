import * as THREE from "three";
import type { RapierRigidBody } from "@react-three/rapier";
import type {
  CharacterDef,
  CombatState,
  FighterState,
  Intent,
  MoveDef,
  Side,
} from "@/game/types";
import { COMBAT, moveDuration, tuningFor, type Tuning } from "@/combat/moves";
import type { Animator } from "@/characters/animations/Animator";
import { emptyIntent } from "@/game/types";

/**
 * FIGHTER STATE — the mutable, per-frame simulation data.
 *
 * Nothing in here is React state. The fight runs at 60fps against these plain
 * objects and only publishes a summary (health, meter, clock) into the zustand
 * store a few times a second. That is what keeps input latency low.
 */
export class FighterRuntime {
  readonly def: CharacterDef;
  readonly side: Side;
  readonly tuning: Tuning;

  /** Mirrored from the Rapier body every frame; the read-only source of truth. */
  readonly position = new THREE.Vector3();
  /** Velocity we ask Rapier for this frame (horizontal only). */
  readonly velocity = new THREE.Vector3();
  /** Decaying push from being hit. Added on top of walking velocity. */
  readonly knockback = new THREE.Vector3();

  /** Yaw in radians. The rig's forward axis is +Z. */
  facing = 0;

  health = 100;
  meter = 0;

  state: FighterState = "IDLE";
  stateTime = 0;
  /** How long the current state must last before the fighter may act again. */
  stateLock = 0;

  combat: CombatState = { move: null, time: 0, connected: false, countered: false };

  /** Set while a counter-special's parry window is open. */
  parrying = false;
  blocking = false;
  /** Seconds of remaining hitstun; the fighter cannot act while > 0. */
  hitstun = 0;
  /** Brief invulnerability while getting up, so you cannot be floor-locked. */
  invuln = 0;
  /** Drives the white flash on the rig when hit. */
  flash = 0;
  /** Consecutive hits landed, reset when the opponent recovers. */
  combo = 0;

  /** Set when a counter-special absorbs a hit: who to punish, and when. */
  counterTarget: FighterRuntime | null = null;
  counterDelay = 0;

  intent: Intent = emptyIntent();
  body: RapierRigidBody | null = null;
  animator: Animator | null = null;
  /** The group holding the rig; the director writes the facing rotation here. */
  visual: THREE.Object3D | null = null;
  /** Materials to tint white for a few frames when hit. */
  rigMaterials: THREE.MeshStandardMaterial[] | null = null;
  /** The head bone, so the director can angle the face towards the camera. */
  rigHead: THREE.Bone | null = null;
  /** Current smoothed head turn in radians, on top of whatever the clip poses. */
  headTurn = 0;
  constructor(def: CharacterDef, side: Side) {
    this.def = def;
    this.side = side;
    this.tuning = tuningFor(def);
  }

  reset(position: THREE.Vector3, facing: number) {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.knockback.set(0, 0, 0);
    this.facing = facing;
    this.health = 100;
    this.meter = 0;
    this.state = "IDLE";
    this.stateTime = 0;
    this.stateLock = 0;
    this.combat = { move: null, time: 0, connected: false, countered: false };
    this.parrying = false;
    this.blocking = false;
    this.hitstun = 0;
    this.invuln = 0;
    this.flash = 0;
    this.combo = 0;
    this.headTurn = 0;
    this.counterTarget = null;
    this.counterDelay = 0;
    this.intent = emptyIntent();
    this.body?.setTranslation(
      { x: position.x, y: position.y, z: position.z },
      true,
    );
    this.body?.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  get alive() {
    return this.health > 0;
  }

  /** True when the fighter is free to start a new action. */
  canAct() {
    if (!this.alive) return false;
    if (this.hitstun > 0) return false;
    return (
      this.state === "IDLE" || this.state === "MOVING" || this.state === "BLOCKING"
    );
  }

  /** True for one frame after a state change, so one-shot clips restart. */
  animRestart = false;

  setState(state: FighterState, lock = 0, force = false) {
    if (this.state !== state || force) {
      this.state = state;
      this.stateTime = 0;
      this.animRestart = true;
    }
    this.stateLock = lock;
  }

  startMove(move: MoveDef) {
    this.combat = { move, time: 0, connected: false, countered: false };
    this.blocking = false;
    this.parrying = false;
    this.setState("ATTACKING", moveDuration(move));
  }

  /** World-space forward vector (the direction the fighter is facing). */
  forward(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  /** World-space right vector. */
  right(out = new THREE.Vector3()) {
    return out.set(-Math.cos(this.facing), 0, Math.sin(this.facing));
  }

  addMeter(amount: number) {
    this.meter = THREE.MathUtils.clamp(this.meter + amount, 0, 100);
  }

  get specialReady() {
    return this.meter >= 100;
  }

  /** Which slice of the current attack we are in, or null if not attacking. */
  attackPhase(): "startup" | "active" | "recovery" | null {
    const m = this.combat.move;
    if (!m || this.state !== "ATTACKING") return null;
    const t = this.combat.time;
    if (t < m.startup) return "startup";
    if (t < m.startup + m.active) return "active";
    return "recovery";
  }
}

/** Everything the simulation needs that is not per-fighter. */
export interface FightRuntime {
  player: FighterRuntime;
  opponent: FighterRuntime;
  /** Global time multiplier: 0 during hitstop, <1 during slow motion. */
  timeScale: number;
  hitstop: number;
  slowmo: number;
  /** Camera shake energy, 0..1, decays every frame. */
  trauma: number;
  clock: number;
  /** Set true once someone hits 0 HP so the KO sequence only runs once. */
  resolved: boolean;
  koTimer: number;
}

export const fight: FightRuntime = {
  player: null as unknown as FighterRuntime,
  opponent: null as unknown as FighterRuntime,
  timeScale: 1,
  hitstop: 0,
  slowmo: 0,
  trauma: 0,
  clock: COMBAT.matchSeconds,
  resolved: false,
  koTimer: 0,
};

export const SPAWN_DISTANCE = 3.2;

export function initFight(playerDef: CharacterDef, opponentDef: CharacterDef) {
  fight.player = new FighterRuntime(playerDef, "player");
  fight.opponent = new FighterRuntime(opponentDef, "opponent");
  resetFight();
  return fight;
}

export function resetFight() {
  const half = SPAWN_DISTANCE / 2;
  fight.player.reset(new THREE.Vector3(-half, 1.0, 0), Math.PI / 2);
  fight.opponent.reset(new THREE.Vector3(half, 1.0, 0), -Math.PI / 2);
  fight.timeScale = 1;
  fight.hitstop = 0;
  fight.slowmo = 0;
  fight.trauma = 0;
  fight.clock = COMBAT.matchSeconds;
  fight.resolved = false;
  fight.koTimer = 0;
}

export function addTrauma(amount: number) {
  fight.trauma = Math.min(1, fight.trauma + amount);
}
