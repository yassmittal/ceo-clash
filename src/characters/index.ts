import type { CharacterDef, FighterId } from "@/game/types";
import { FIGHTER_IDS } from "./roster";
import { SAM } from "./Sam";
import { DARIO } from "./Dario";
import { TRUMP } from "./Trump";
import { ELON } from "./Elon";
import { ZUCK } from "./Zuck";
import { COOK } from "./Cook";

/**
 * Every fighter, by id. The Record type is the registration check: an id added
 * to roster.ts without a def here (or a def whose id is not in the roster) is a
 * compile error, not a runtime undefined.
 */
export const CHARACTERS: Record<FighterId, CharacterDef> = {
  sam: SAM,
  dario: DARIO,
  trump: TRUMP,
  elon: ELON,
  zuck: ZUCK,
  cook: COOK,
};

/** Select-screen order, straight from the roster. */
export const CHARACTER_LIST: CharacterDef[] = FIGHTER_IDS.map((id) => CHARACTERS[id]);

export { FIGHTER_IDS };
export type { FighterId };

/** Any fighter except `id`, uniformly. Used for "random opponent". */
export function randomOpponent(id: FighterId, rand: () => number = Math.random): FighterId {
  const pool = FIGHTER_IDS.filter((other) => other !== id);
  return pool[Math.floor(rand() * pool.length)] ?? id;
}

/** A random distinct pair, for anything that wants to show two fighters. */
export function randomPair(rand: () => number = Math.random): [FighterId, FighterId] {
  const a = FIGHTER_IDS[Math.floor(rand() * FIGHTER_IDS.length)];
  return [a, randomOpponent(a, rand)];
}

/**
 * Photographers grouped by licence, for the attribution line on the menu.
 * Public domain comes out first and carries no link; everything else is
 * grouped under its deed so each licence is named once.
 */
export interface CreditGroup {
  license: string;
  licenseUrl?: string;
  authors: string[];
}

export function photoCredits(list: CharacterDef[] = CHARACTER_LIST): CreditGroup[] {
  const groups = new Map<string, CreditGroup>();
  for (const def of list) {
    const { license, licenseUrl, author } = def.photo;
    let g = groups.get(license);
    if (!g) {
      g = { license, licenseUrl, authors: [] };
      groups.set(license, g);
    }
    if (!g.authors.includes(author)) g.authors.push(author);
  }
  const isPd = (g: CreditGroup) => /public domain/i.test(g.license);
  return [...groups.values()].sort((a, b) => Number(isPd(b)) - Number(isPd(a)));
}
