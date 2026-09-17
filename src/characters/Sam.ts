import type { CharacterDef } from "@/game/types";

/**
 * Fictional parody fighter. The numbers are gameplay dials, nothing else.
 */
export const SAM: CharacterDef = {
  id: "sam",
  name: "SAM",
  title: "THE SCALER",
  tagline: "Ships first. Reads the eval later.",
  hasHead: true,
  stats: { speed: 70, attack: 70, defense: 64, aggression: 74 },
  special: {
    name: "GPT SMASH",
    kind: "strike",
    description: "A wildly overconfident haymaker. Huge damage, huge whiff.",
  },
  colors: {
    primary: "#1f8cff",
    secondary: "#0b2a4a",
    skin: "#ec9e7e",
    hair: "#412b16",
    accent: "#7ee0ff",
  },
  koLines: [
    "BRO GOT BENCHMARKED 💀",
    "CONTEXT WINDOW DESTROYED",
    "SCALED. LITERALLY.",
    "TRAINING RUN TERMINATED",
  ],  photo: {
    author: "Steve Jurvetson",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Sam_Altman_speaking_at_TED_(cropped).jpg",
  },
};
