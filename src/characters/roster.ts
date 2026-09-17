/**
 * The roster, as a list of ids and nothing else.
 *
 * This is the one place a fighter is registered. `FighterId` is derived from it,
 * so adding someone means adding their id here and their def in `index.ts` —
 * the `Record<FighterId, CharacterDef>` there refuses to compile until both
 * exist. It lives in its own file, with no imports, so `game/types.ts` can take
 * the type from it without an import cycle through the character defs.
 *
 * Order is the order of the select screen.
 */
export const FIGHTER_IDS = ["sam", "dario", "trump", "elon", "zuck", "cook"] as const;

export type FighterId = (typeof FIGHTER_IDS)[number];
