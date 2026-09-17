/**
 * The comedy layer, in one file.
 *
 * The plan is explicit that this should not be overbuilt: a handful of good
 * lines, pulled at random, is the whole system.
 */

import type { CharacterDef } from "@/game/types";

const pick = <T,>(list: readonly T[]) => list[(Math.random() * list.length) | 0];

/**
 * A fighter's own line about half the time, the shared pool otherwise. The
 * shared pools stay the backbone so a signature line is a treat, not a loop.
 *
 * Tone rule for every line in here and on the defs: jokes land on the public
 * persona or the company — shipping, keynotes, rockets, deals, the metaverse.
 * No fake quotes passed off as real, no politics with teeth, nothing about
 * family, health, religion or ethnicity.
 */
const signature = (own: readonly string[] | undefined, shared: readonly string[]) =>
  own && own.length > 0 && Math.random() < 0.5 ? pick(own) : pick(shared);

export const BIG_HIT_LINES = [
  "BENCHMARKED 💀",
  "CONTEXT WINDOW DESTROYED",
  "TOKEN BURNED",
  "HALLUCINATION DETECTED",
  "EVAL FAILED",
  "LATENCY SPIKE",
  "RATE LIMITED",
  "PATCH NOTES: YOU",
  "404: GUARD NOT FOUND",
] as const;

export const KNOCKDOWN_LINES = [
  "MODEL COLLAPSED",
  "TRAINING RUN TERMINATED",
  "SERVER DOWN",
  "OOM KILLED",
  "GPU MELTED",
] as const;

export const BLOCK_LINES = ["GUARDRAILS HELD", "REFUSED", "SAFETY LAYER", "DECLINED"] as const;

export const SPECIAL_LINES = ["100% INFERENCE. 0% SURVIVAL.", "SCALING LAWS APPLIED", "COMPUTE UNLEASHED"] as const;

export const COUNTER_LINES = ["CONSTITUTIONALLY REJECTED", "COUNTERPOINT.", "ALIGNMENT ENFORCED"] as const;

export const KO_LINES = [
  "THE CEO HAS BEEN BENCHMARKED 💀",
  "SHIPPED. STRAIGHT TO THE FLOOR.",
  "DEPRECATED IN PRODUCTION",
  "100% INFERENCE. 0% SURVIVAL.",
  "THAT RUN DID NOT CONVERGE",
] as const;

export const TIMEOUT_LINE = "COMPUTE BUDGET EXHAUSTED";

export const bigHitLine = (by?: CharacterDef) => signature(by?.bigHitLines, BIG_HIT_LINES);
export const knockdownLine = () => pick(KNOCKDOWN_LINES);
export const blockLine = () => pick(BLOCK_LINES);
export const specialLine = (by?: CharacterDef) => signature(by?.specialLines, SPECIAL_LINES);
export const counterLine = () => pick(COUNTER_LINES);
export const koLine = (by?: CharacterDef) => signature(by?.koLines, KO_LINES);

/** Rotating nonsense for the arena's jumbotron. */
export const ARENA_TICKER = [
  "COMPUTE SPONSORED BY YOUR RETIREMENT FUND",
  "NOW WITH 400% MORE PARAMETERS",
  "SAFETY TEAM: ON A WALK",
  "H100 GIVEAWAY AT HALFTIME",
  "PLEASE DO NOT FEED THE AGENTS",
  "THIS ARENA IS ALSO A DATA CENTER",
  "TONIGHT'S UNDERCARD: SIX CEOS, ZERO BOARD APPROVAL",
  "CONCESSIONS NOW ACCEPT DOGECOIN, APPLE PAY AND VIBES",
  "RINGSIDE SEATS SOLD AS A SUBSCRIPTION",
  "THE METAVERSE SECTION IS STILL EMPTY",
  "NEXT BOUT DELAYED FOR ONE MORE THING",
  "FIGHT CARD SUBJECT TO A HUGE RENEGOTIATION",
  "ROCKET-POWERED JUMBOTRON: RUD PENDING",
] as const;
