import type { CharacterDef } from "@/game/types";

/**
 * Fictional parody fighter. The numbers are gameplay dials, nothing else.
 */
export const SAM: CharacterDef = {
  id: "sam",
  name: "SAM",
  title: "THE SCALER",
  tagline: "Ships first. Reads the eval later.",
  stats: { speed: 80, attack: 60, defense: 50, aggression: 80 },
  special: {
    name: "GPT SMASH",
    kind: "strike",
    description: "A wildly overconfident haymaker. Huge damage, huge whiff.",
  },
  colors: {
    primary: "#1f8cff",
    secondary: "#0b2a4a",
    skin: "#e6b58e",
    accent: "#7ee0ff",
  },
  koLines: [
    "BRO GOT BENCHMARKED 💀",
    "CONTEXT WINDOW DESTROYED",
    "SCALED. LITERALLY.",
    "TRAINING RUN TERMINATED",
  ],
};
