import type { CharacterDef } from "@/game/types";

/**
 * Fictional parody fighter. The numbers are gameplay dials, nothing else.
 *
 * Archetype: the wall. Slowest to start anything, hardest to get through — a
 * counter that opens a hair earlier and answers harder.
 */
export const COOK: CharacterDef = {
  id: "cook",
  name: "TIM",
  title: "THE OPERATOR",
  tagline: "Optimises the supply chain of your defeat.",
  hasHead: false,
  stats: { speed: 58, attack: 62, defense: 78, aggression: 60 },
  special: {
    name: "ONE MORE THING",
    kind: "counter",
    description: "Looks like the keynote is over. Then there is one more thing.",
    tuning: { startup: 0.04, damage: 32, knockback: 16 },
  },
  colors: {
    primary: "#aab8cc",
    secondary: "#26303d",
    skin: "#e1aa98",
    hair: "#a99c6c",
    accent: "#e8eef7",
  },
  koLines: [
    "SUPPLY CHAIN DISRUPTED",
    "UPGRADE REQUIRED",
    "NOW AVAILABLE IN SPACE GREY",
    "COURAGE.",
  ],
  bigHitLines: ["PRO MAX DAMAGE", "DONGLE REQUIRED", "THINNER. LIGHTER. HARDER.", "ONE MORE THING"],
  specialLines: ["AND ONE MORE THING…", "IT JUST WORKS"],
  photo: {
    author: "Christophe Licoppe (European Commission)",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Visit_of_Tim_Cook_to_the_European_Commission_-_P061904-946789.jpg",
  },
};
