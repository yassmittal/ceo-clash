/**
 * Shared vocabulary for the whole game.
 *
 * The plan asks for a clear separation between four different kinds of state.
 * They are deliberately different types in this file:
 *
 *   GamePhase      — where the *application* is (menu, countdown, fighting, winner)
 *   FighterState   — what a *fighter* is doing right now (the gameplay state machine)
 *   AnimState      — which *animation clip* should be playing (a pure view of the above)
 *   CombatState    — the per-attack bookkeeping (startup/active/recovery, did it connect)
 *
 * Gameplay code only ever writes FighterState + CombatState. AnimState is derived
 * from them once per frame, so animation can never disagree with gameplay.
 */

export type GamePhase =
  | "MENU"
  | "CHARACTER_SELECT"
  | "LOADING"
  | "COUNTDOWN"
  | "FIGHTING"
  | "KO"
  | "WINNER";

import type { FighterId } from "@/characters/roster";
export type { FighterId };
export type Side = "player" | "opponent";

export type FighterState =
  | "IDLE"
  | "MOVING"
  | "ATTACKING"
  | "BLOCKING"
  | "HIT"
  | "KNOCKED_DOWN"
  | "GETTING_UP"
  | "DEFEATED"
  | "VICTORY";

/** One clip name per animation state. Maps 1:1 onto GLB clip names later. */
export type AnimState =
  | "IDLE"
  | "WALK"
  | "RUN"
  | "PUNCH"
  | "KICK"
  | "BLOCK"
  | "HIT"
  | "KNOCKDOWN"
  | "GET_UP"
  | "VICTORY"
  | "DEFEAT"
  | "SPECIAL";

export type MoveId = "punch" | "kick" | "special";

/** Which slice of an attack we are in. Hitboxes only exist during "active". */
export type AttackPhase = "startup" | "active" | "recovery";

export interface CombatState {
  move: MoveDef | null;
  /** Seconds since the attack started. */
  time: number;
  /** An attack may only connect once per activation. */
  connected: boolean;
  /** Counter-specials absorb one hit; this flags that the absorb happened. */
  countered: boolean;
}

export interface MoveDef {
  id: MoveId;
  label: string;
  /** How the move behaves: a normal strike, or a parry that answers with a strike. */
  kind: "strike" | "counter";
  anim: AnimState;
  /** Frame data, in seconds. startup -> active -> recovery. */
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  /** Metres/second of push applied to whoever gets hit. */
  knockback: number;
  /** Seconds the victim is stunned for. */
  hitstun: number;
  /** Always floors the victim (kick floors on counter-hit only). */
  knockdown: boolean;
  /**
   * Heavy attacks smash through a guard: blocking them costs real health and
   * leaves you stunned. Without this, holding block would be strictly dominant.
   */
  guardBreak: boolean;
  /** Hitbox: distance in front of the chest, height off the floor, radius. */
  reach: number;
  height: number;
  radius: number;
  /** Global freeze-frame on impact, in seconds. Sells the hit. */
  hitstop: number;
  /** Slow-motion window after impact, in seconds. 0 = none. */
  slowmo: number;
  /** How much special meter landing this move grants the attacker. */
  meterGain: number;
  /** Meter cost to use it. */
  meterCost: number;
  /** Movement carried by the attack itself (a lunge). */
  lunge: number;
  screenShake: number;
}

export interface CharacterDef {
  id: FighterId;
  name: string;
  /** Shown on the select screen — flavour only. */
  title: string;
  tagline: string;
  /**
   * Whether `public/models/<id>-head.glb` ships. False means the fighter wears
   * the blocky face-textured head and the loader never requests a file that
   * isn't there (no 404 in the console). Flip it when build-heads.py has
   * produced the model.
   */
  hasHead: boolean;
  /** Raw design numbers from the plan (0-100). Tuning derives from these. */
  stats: { speed: number; attack: number; defense: number; aggression: number };
  special: {
    name: string;
    /**
     * Which of the two special mechanics this fighter uses. The frame data and
     * the clip come from the kind; everything else here is presentation.
     */
    kind: "strike" | "counter";
    description: string;
    /**
     * Optional per-fighter adjustments on top of the kind's base frame data in
     * combat/moves.ts. Deliberately a short list: the numbers that change how a
     * special feels without changing how it works or how long its clip runs.
     */
    tuning?: Partial<Pick<MoveDef, "damage" | "startup" | "lunge" | "knockback" | "reach">>;
  };
  colors: {
    primary: string;
    secondary: string;
    /** Skin and hair are sampled from the fighter's face photo by
     *  scripts/build-faces.py, so the head block matches the neck and forearms
     *  instead of sitting on top of them like a sticker. */
    skin: string;
    hair: string;
    accent: string;
  };
  /** Silly lines shown when this character lands a KO. */
  koLines: string[];
  /** Optional signature lines, mixed in with the shared pools in brainrot.ts. */
  bigHitLines?: string[];
  specialLines?: string[];
  /**
   * Where the likeness came from. The menu builds its attribution line from
   * this, so a new fighter cannot ship without their photographer credited.
   * Kept in step with scripts/build-faces.py, which is where the photo is cut.
   */
  photo: PhotoCredit;
}

export interface PhotoCredit {
  author: string;
  /** Short licence name as it should be printed, e.g. "CC BY 2.0". */
  license: string;
  /** Deed URL; omitted for public domain, which has none to link. */
  licenseUrl?: string;
  /** The Commons file page. */
  sourceUrl: string;
}

/** What a controller (human or AI) wants to do this frame. Both produce this. */
export interface Intent {
  /** -1..1 in fighter-local space: x = strafe, z = toward/away from opponent. */
  moveX: number;
  moveZ: number;
  punch: boolean;
  kick: boolean;
  block: boolean;
  special: boolean;
}

export const emptyIntent = (): Intent => ({
  moveX: 0,
  moveZ: 0,
  punch: false,
  kick: false,
  block: false,
  special: false,
});
