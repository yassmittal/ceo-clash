import type { CharacterDef } from "@/game/types";

/**
 * Fictional parody fighter. The numbers are gameplay dials, nothing else.
 */
export const DARIO: CharacterDef = {
  id: "dario",
  name: "DARIO",
  title: "THE ALIGNER",
  tagline: "Blocks first. Asks questions never.",
  stats: { speed: 60, attack: 70, defense: 80, aggression: 60 },
  special: {
    name: "CLAUDE COUNTER",
    kind: "counter",
    description: "Absorbs the next hit and answers with a devastating rebuttal.",
  },
  colors: {
    primary: "#ff7a45",
    secondary: "#4a1f0b",
    skin: "#d9a982",
    accent: "#ffd18c",
  },
  koLines: [
    "MODEL COLLAPSED",
    "HALLUCINATION DETECTED",
    "100% INFERENCE. 0% SURVIVAL.",
    "AGENT FAILED",
  ],
};
