/**
 * The comedy layer, in one file.
 *
 * The plan is explicit that this should not be overbuilt: a handful of good
 * lines, pulled at random, is the whole system.
 */

const pick = <T,>(list: readonly T[]) => list[(Math.random() * list.length) | 0];

export const BIG_HIT_LINES = [
  "BENCHMARKED 💀",
  "CONTEXT WINDOW DESTROYED",
  "TOKEN BURNED",
  "HALLUCINATION DETECTED",
  "EVAL FAILED",
  "LATENCY SPIKE",
  "RATE LIMITED",
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

export const bigHitLine = () => pick(BIG_HIT_LINES);
export const knockdownLine = () => pick(KNOCKDOWN_LINES);
export const blockLine = () => pick(BLOCK_LINES);
export const specialLine = () => pick(SPECIAL_LINES);
export const counterLine = () => pick(COUNTER_LINES);
export const koLine = () => pick(KO_LINES);

/** Rotating nonsense for the arena's jumbotron. */
export const ARENA_TICKER = [
  "COMPUTE SPONSORED BY YOUR RETIREMENT FUND",
  "NOW WITH 400% MORE PARAMETERS",
  "SAFETY TEAM: ON A WALK",
  "H100 GIVEAWAY AT HALFTIME",
  "PLEASE DO NOT FEED THE AGENTS",
  "THIS ARENA IS ALSO A DATA CENTER",
] as const;
