import type { CharacterDef } from "@/game/types";

/**
 * Fictional parody fighter. The numbers are gameplay dials, nothing else.
 *
 * Archetype: the glass cannon. Hits hardest and moves fast, guards like
 * a prototype — a strike special with a huge, fast launch.
 */
export const ELON: CharacterDef = {
  id: "elon",
  name: "ELON",
  title: "THE SHIPPOSTER",
  tagline: "Ships it at 3am. Posts about it at 3:01.",
  hasHead: false,
  stats: { speed: 70, attack: 85, defense: 50, aggression: 80 },
  special: {
    name: "ROCKET UPPERCUT",
    kind: "strike",
    description: "Launches from across the ring. Might land. Might rapidly disassemble.",
    // Covers more ground, a touch quicker, a touch lighter.
    tuning: { startup: 0.3, damage: 25, lunge: 7 },
  },
  colors: {
    primary: "#8f6bff",
    secondary: "#241a4a",
    skin: "#c17b6b",
    hair: "#3e2723",
    accent: "#d0c2ff",
  },
  koLines: [
    "RAPID UNSCHEDULED DISASSEMBLY",
    "LAUNCH SUCCESSFUL. OPPONENT NOT.",
    "FULL SELF-KNOCKING-OUT (SUPERVISED)",
    "RATIO'D",
  ],
  bigHitLines: ["TO THE MOON", "HARDCORE MODE", "POSTED", "LOCKED IN"],
  specialLines: ["T-MINUS ZERO", "MAX THRUST"],
  photo: {
    author: "Trevor Cokley (U.S. Air Force)",
    license: "Public domain",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Elon_Musk_Colorado_2022.jpg",
  },
};
