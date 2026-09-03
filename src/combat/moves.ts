import type { CharacterDef, MoveDef, MoveId } from "@/game/types";

/**
 * Frame data lives here and nowhere else.
 *
 * Everything about how a move *feels* — how long you are committed to it, when
 * the hitbox exists, how far it reaches, how hard it throws people — is a number
 * in this file. Tuning the game should never mean editing the combat code.
 */

export const PUNCH: MoveDef = {
  id: "punch",
  label: "JAB",
  kind: "strike",
  anim: "PUNCH",
  startup: 0.09,
  active: 0.07,
  recovery: 0.19,
  damage: 7,
  knockback: 3.4,
  hitstun: 0.26,
  knockdown: false,
  guardBreak: false,
  reach: 1.05,
  height: 1.25,
  radius: 0.5,
  hitstop: 0.05,
  slowmo: 0,
  meterGain: 7,
  meterCost: 0,
  lunge: 1.6,
  screenShake: 0.22,
};

export const KICK: MoveDef = {
  id: "kick",
  label: "ROUNDHOUSE",
  kind: "strike",
  anim: "KICK",
  startup: 0.19,
  active: 0.1,
  recovery: 0.36,
  damage: 13,
  knockback: 6.8,
  hitstun: 0.42,
  knockdown: false, // floors on counter-hit only; see CombatSystem
  guardBreak: true,
  reach: 1.3,
  height: 0.95,
  radius: 0.58,
  hitstop: 0.09,
  slowmo: 0,
  meterGain: 11,
  meterCost: 0,
  lunge: 2.4,
  screenShake: 0.42,
};

export const GPT_SMASH: MoveDef = {
  id: "special",
  label: "GPT SMASH",
  kind: "strike",
  anim: "SPECIAL",
  startup: 0.34,
  active: 0.16,
  recovery: 0.62,
  damage: 27,
  knockback: 15,
  hitstun: 0.6,
  knockdown: true,
  guardBreak: true,
  reach: 1.5,
  height: 1.2,
  radius: 0.8,
  hitstop: 0.2,
  slowmo: 0.7,
  meterGain: 0,
  meterCost: 100,
  lunge: 5.5,
  screenShake: 1,
};

export const CLAUDE_COUNTER: MoveDef = {
  id: "special",
  label: "CLAUDE COUNTER",
  kind: "counter",
  anim: "SPECIAL",
  /**
   * Deliberately shorter than any attack's startup (a jab is 0.09s): a counter
   * that loses to a simultaneous jab is not a counter. Total duration still
   * matches the SPECIAL clip at 1.12s.
   */
  startup: 0.05,
  /** The "active" window of a counter is the parry window. */
  active: 0.63,
  recovery: 0.44,
  damage: 30,
  knockback: 14,
  hitstun: 0.6,
  knockdown: true,
  guardBreak: true,
  reach: 1.6,
  height: 1.2,
  radius: 0.9,
  hitstop: 0.22,
  slowmo: 0.8,
  meterGain: 0,
  meterCost: 100,
  lunge: 3,
  screenShake: 1,
};

export const specialFor = (c: CharacterDef): MoveDef =>
  c.special.kind === "counter" ? CLAUDE_COUNTER : GPT_SMASH;

export const moveFor = (c: CharacterDef, id: MoveId): MoveDef =>
  id === "punch" ? PUNCH : id === "kick" ? KICK : specialFor(c);

export const moveDuration = (m: MoveDef) => m.startup + m.active + m.recovery;

/**
 * Per-character multipliers derived from the design stats. The stats are 0-100
 * "vibes" numbers; this is the one place they turn into physics.
 */
export interface Tuning {
  walkSpeed: number;
  runSpeed: number;
  damageOut: number;
  damageIn: number;
  turnSpeed: number;
  getUpTime: number;
}

export const tuningFor = (c: CharacterDef): Tuning => ({
  walkSpeed: 2.0 + (c.stats.speed / 100) * 1.6,
  runSpeed: 3.4 + (c.stats.speed / 100) * 2.6,
  // Kept deliberately narrow. Wide stat spreads make the AI mirror lopsided
  // without making the player-vs-AI fight any more interesting.
  damageOut: 0.78 + (c.stats.attack / 100) * 0.36,
  damageIn: 1.18 - (c.stats.defense / 100) * 0.34,
  turnSpeed: 8 + (c.stats.speed / 100) * 6,
  getUpTime: 1.35 - (c.stats.speed / 100) * 0.3,
});

/** Global feel constants. */
export const COMBAT = {
  /** Damage that gets through a successful block. */
  chipMultiplier: 0.16,
  /** Damage a guard-breaking heavy attack deals through a block. */
  guardBreakMultiplier: 0.45,
  /** How long a broken guard leaves you helpless. */
  guardBreakStun: 0.45,
  blockKnockbackMultiplier: 0.45,
  blockStun: 0.16,
  /** You must be facing the attacker within this half-angle to block. */
  blockArcCos: Math.cos((110 * Math.PI) / 180),
  /** Knockback decays at this rate (per second, exponential). */
  knockbackDamping: 5.5,
  /** Meter gained per point of damage taken. */
  meterPerDamageTaken: 0.85,
  /** Passive meter per second while fighting. */
  meterPerSecond: 3.2,
  knockdownDuration: 0.85,
  /** Random chance a kick floors someone even without a counter-hit. */
  kickKnockdownChance: 0.22,
  /** How close fighters may get before the capsules push each other apart. */
  bodyRadius: 0.42,
  arenaRadius: 9.2,
  hurtboxLow: 0.35,
  hurtboxHigh: 1.6,
  hurtboxRadius: 0.44,
  matchSeconds: 90,
} as const;
