import type { CharacterDef } from "@/game/types";

/**
 * Fictional parody fighter. The numbers are gameplay dials, nothing else.
 *
 * Archetype: the bruiser. Slow feet, heavy hands, hard to move — a strike
 * special that takes a long time to close and hits like it.
 */
export const TRUMP: CharacterDef = {
  id: "trump",
  name: "DONALD",
  title: "THE DEALMAKER",
  tagline: "Never reads the terms. Signs them in gold marker.",
  hasHead: false,
  stats: { speed: 50, attack: 72, defense: 75, aggression: 64 },
  special: {
    name: "TREMENDOUS DEAL",
    kind: "strike",
    description: "Takes forever to close. When it closes, it closes on your face.",
    // Slower to wind up than the default smash, and harder to take.
    tuning: { startup: 0.4, damage: 27, lunge: 4.6 },
  },
  colors: {
    primary: "#f5b301",
    secondary: "#4a3500",
    skin: "#b36b49",
    hair: "#b39e82",
    accent: "#ffe28a",
  },
  koLines: [
    "DEAL CLOSED 🤝",
    "YOU'RE FIRED. FROM THE ARENA.",
    "THE BIGGEST K.O. ANYONE HAS EVER SEEN",
    "NOBODY FALLS DOWN BETTER",
  ],
  bigHitLines: ["HUGE", "TREMENDOUS", "RENEGOTIATED", "GOLD-PLATED HIT"],
  specialLines: ["THE ART OF THE SMASH", "CLOSING THE DEAL"],
  photo: {
    author: "Shealah Craighead (The White House)",
    license: "Public domain",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Donald_Trump_official_portrait.jpg",
  },
};
