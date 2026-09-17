import type { CharacterDef } from "@/game/types";

/**
 * Fictional parody fighter. The numbers are gameplay dials, nothing else.
 *
 * Archetype: the counter-puncher. Quick on his feet, sits back, waits for you
 * to commit — a counter with a little extra reach on the answer.
 */
export const ZUCK: CharacterDef = {
  id: "zuck",
  name: "MARK",
  title: "THE METAVERSE",
  tagline: "Moves fast. Breaks things. Mostly you.",
  hasHead: false,
  stats: { speed: 75, attack: 66, defense: 78, aggression: 60 },
  special: {
    name: "PIVOT TO COUNTER",
    kind: "counter",
    description: "Absorbs your hit, rebrands it, and ships it back to you.",
    tuning: { damage: 27, reach: 1.8 },
  },
  colors: {
    primary: "#2fe07a",
    secondary: "#0b3a22",
    skin: "#eb9f9f",
    hair: "#835669",
    accent: "#a5ffcb",
  },
  koLines: [
    "CONNECTION TERMINATED",
    "ACCOUNT SUSPENDED",
    "YOU'VE BEEN POKED",
    "WELCOME TO THE METAVERSE. POPULATION: YOU.",
  ],
  bigHitLines: ["ENGAGEMENT UP", "PIVOTED", "ALGORITHM'D", "LEGS NOT INCLUDED"],
  specialLines: ["REBRANDED", "HEADSET ON"],
  photo: {
    author: "Anthony Quintano",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Mark_Zuckerberg_F8_2019_Keynote_(32830578717)_(cropped).jpg",
  },
};
