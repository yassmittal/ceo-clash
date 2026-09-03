import type { CharacterDef, FighterId } from "@/game/types";
import { SAM } from "./Sam";
import { DARIO } from "./Dario";

export const CHARACTERS: Record<FighterId, CharacterDef> = { sam: SAM, dario: DARIO };
export const CHARACTER_LIST: CharacterDef[] = [SAM, DARIO];
export const other = (id: FighterId): FighterId => (id === "sam" ? "dario" : "sam");
export { SAM, DARIO };
