import type { Intent } from "@/game/types";
import { emptyIntent } from "@/game/types";
import type { FighterRuntime } from "@/game/runtime";

/**
 * OPPONENT AI — a deterministic state machine, deliberately a bit dim.
 *
 * No LLM, no pathfinding, no search. It picks a state, commits to it for a
 * readable amount of time, then picks again. The goal from the plan:
 * predictable enough to learn, random enough to stay funny, aggressive enough
 * that the fight never stalls.
 *
 * The AI produces the same `Intent` a keyboard does, so it plays by exactly the
 * same rules as the player — same startup frames, same recovery, same meter.
 */

type AiState = "IDLE" | "CHASE" | "ATTACK" | "BLOCK" | "RETREAT" | "RECOVER" | "SHOWBOAT";

const ATTACK_RANGE = 1.75;
const CLOSE_RANGE = 2.6;

export class FighterAI {
  state: AiState = "IDLE";
  private timer = 0;
  /** Rebuilt when a state is entered; drives strafing direction. */
  private strafe = 0;
  /** Fires an attack on exactly one frame. */
  private pendingAttack: "punch" | "kick" | "special" | null = null;
  private reaction = 0;
  /** True while the fighter is stunned or committed to a move. */
  private busy = false;
  /** Whether the thing keeping it busy was its own attack, or a beating. */
  private wasAttacking = false;

  reset() {
    this.state = "IDLE";
    this.timer = 0.6;
    this.strafe = 0;
    this.pendingAttack = null;
    this.busy = false;
    this.wasAttacking = false;
    this.reaction = 0;
  }

  update(self: FighterRuntime, target: FighterRuntime, dt: number, canFight: boolean): Intent {
    const intent = emptyIntent();
    if (!canFight || !self.alive || !target.alive) return intent;

    // Stunned, floored or mid-attack: nothing to decide, the controller is busy.
    if (!self.canAct()) {
      this.busy = true;
      this.state = "RECOVER";
      // Remember what ended the turn — the last state before recovering wins, so
      // being counter-hit out of an attack counts as a beating, not an attack.
      this.wasAttacking = self.state === "ATTACKING";
      return intent;
    }

    if (this.busy) {
      this.busy = false;
      // A breather AFTER OUR OWN attack, so the player gets a turn. Never after
      // being hit — pausing there would let anyone jab-lock the AI forever.
      const aggression = self.def.stats.aggression / 100;
      this.timer = this.wasAttacking ? 0.12 + Math.random() * 0.3 * (1.5 - aggression) : 0;
      this.state = "IDLE";
    }

    this.timer -= dt;
    if (this.reaction > 0) this.reaction -= dt;

    const dx = target.position.x - self.position.x;
    const dz = target.position.z - self.position.z;
    const distance = Math.hypot(dx, dz);

    // Reactive layer: if a hit is coming and we are in range, sometimes answer it.
    const incoming =
      target.state === "ATTACKING" &&
      (target.attackPhase() === "startup" || target.attackPhase() === "active") &&
      distance < CLOSE_RANGE;

    if (incoming && this.reaction <= 0 && this.state !== "BLOCK" && this.state !== "ATTACK") {
      const defense = self.def.stats.defense / 100;
      const roll = Math.random();
      if (roll < 0.28 + defense * 0.34) {
        this.enter("BLOCK", 0.35 + Math.random() * 0.35);
      } else if (roll < 0.5 + defense * 0.2) {
        this.enter("RETREAT", 0.25 + Math.random() * 0.25);
      }
      // Human-ish reaction cooldown; without it the AI blocks everything.
      this.reaction = 0.35 + Math.random() * 0.4;
    }

    if (this.timer <= 0) this.decide(self, target, distance);

    // --- turn the current state into an Intent ---------------------------
    switch (this.state) {
      case "CHASE":
        intent.moveZ = 1;
        intent.moveX = this.strafe * 0.4;
        break;
      case "RETREAT":
        intent.moveZ = -1;
        intent.moveX = this.strafe * 0.6;
        break;
      case "BLOCK":
        intent.block = true;
        if (distance < ATTACK_RANGE * 0.8) intent.moveZ = -0.4;
        break;
      case "SHOWBOAT":
        // Pure comedy: circle-strafing and whiffing at nothing.
        intent.moveX = this.strafe;
        break;
      case "ATTACK":
        if (this.pendingAttack) {
          intent[this.pendingAttack] = true;
          this.pendingAttack = null;
        } else if (distance > ATTACK_RANGE) {
          intent.moveZ = 1;
        }
        break;
      case "IDLE":
      case "RECOVER":
      default:
        // Drift toward the player so the fight never stalls out at range.
        if (distance > CLOSE_RANGE) intent.moveZ = 0.5;
        break;
    }

    return intent;
  }

  private enter(state: AiState, duration: number) {
    this.state = state;
    this.timer = duration;
    if (state === "CHASE" || state === "RETREAT" || state === "SHOWBOAT") {
      this.strafe = Math.random() < 0.5 ? -1 : 1;
    }
  }

  private decide(self: FighterRuntime, target: FighterRuntime, distance: number) {
    const aggression = self.def.stats.aggression / 100;
    const hurt = self.health < 32;
    const roll = Math.random();

    // Special: fire it when it is likely to matter.
    if (self.specialReady) {
      const isCounter = self.def.special.kind === "counter";
      const wantsCounter =
        isCounter && distance < CLOSE_RANGE && (target.state === "ATTACKING" || roll < 0.25);
      const wantsSmash = !isCounter && distance < ATTACK_RANGE * 1.3 && roll < 0.6;
      if (wantsCounter || wantsSmash) {
        this.pendingAttack = "special";
        this.enter("ATTACK", 0.9);
        return;
      }
    }

    if (distance > CLOSE_RANGE) {
      // Far away: mostly close the gap, occasionally do something stupid.
      if (roll < 0.08) this.enter("SHOWBOAT", 0.4 + Math.random() * 0.5);
      else if (roll < 0.14 && distance < CLOSE_RANGE * 1.6) {
        this.pendingAttack = "kick"; // a hopeful whiff from way out
        this.enter("ATTACK", 0.7);
      } else this.enter("CHASE", 0.35 + Math.random() * 0.5);
      return;
    }

    if (distance > ATTACK_RANGE) {
      if (roll < 0.6 * aggression + 0.2) this.enter("CHASE", 0.2 + Math.random() * 0.3);
      else if (roll < 0.85) this.enter("BLOCK", 0.3 + Math.random() * 0.3);
      else this.enter("RETREAT", 0.25 + Math.random() * 0.3);
      return;
    }

    // In range.
    const attackChance = hurt ? 0.35 * aggression : 0.55 + aggression * 0.3;
    if (roll < attackChance) {
      // Kicks break guards, so a turtling player gets kicked.
      const kickBias = target.state === "BLOCKING" ? 0.75 : 0.35;
      this.pendingAttack = Math.random() < kickBias ? "kick" : "punch";
      this.enter("ATTACK", 0.35 + Math.random() * 0.3);
    } else if (roll < attackChance + (hurt ? 0.4 : 0.22)) {
      this.enter("BLOCK", 0.3 + Math.random() * 0.4);
    } else if (roll < attackChance + 0.5) {
      this.enter("RETREAT", 0.2 + Math.random() * 0.3);
    } else {
      this.enter("IDLE", 0.15 + Math.random() * 0.25);
    }
  }
}
