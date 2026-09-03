import type { Intent } from "@/game/types";

/**
 * INPUT LAYER
 *
 * Two indirections keep this swappable, which is what the plan asks for:
 *
 *   physical key  ->  ActionName  ->  Intent
 *
 * Rebinding is editing KEYMAP (or writing a new one to localStorage). Adding
 * gamepad or touch support later means producing an Intent from a different
 * source — the player controller never learns what a keyboard is.
 */

export type ActionName =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "punch"
  | "kick"
  | "block"
  | "special";

export type KeyMap = Record<string, ActionName>;

export const DEFAULT_KEYMAP: KeyMap = {
  KeyW: "forward",
  KeyS: "back",
  KeyA: "left",
  KeyD: "right",
  ArrowUp: "forward",
  ArrowDown: "back",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyJ: "punch",
  KeyK: "kick",
  KeyL: "block",
  Space: "special",
};

const STORAGE_KEY = "ceo-clash:keymap";

export function loadKeymap(): KeyMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_KEYMAP, ...(JSON.parse(raw) as KeyMap) };
  } catch {
    /* storage can be unavailable; defaults are fine */
  }
  return { ...DEFAULT_KEYMAP };
}

export function saveKeymap(map: KeyMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Human-readable labels for the controls overlay. */
export function controlHints(map: KeyMap): Array<[string, string]> {
  const find = (action: ActionName) =>
    Object.keys(map)
      .filter((k) => map[k] === action)
      .map(prettyKey)[0] ?? "?";
  return [
    [`${find("forward")}${find("left")}${find("back")}${find("right")}`, "MOVE"],
    [find("punch"), "PUNCH"],
    [find("kick"), "KICK"],
    [find("block"), "BLOCK"],
    [find("special"), "SPECIAL"],
  ];
}

export function prettyKey(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code === "Space") return "SPACE";
  if (code.startsWith("Arrow")) return code.slice(5).toUpperCase();
  return code.toUpperCase();
}

export function intentFromActions(active: Set<ActionName>, pressed: Set<ActionName>): Intent {
  const axis = (neg: ActionName, pos: ActionName) =>
    (active.has(pos) ? 1 : 0) - (active.has(neg) ? 1 : 0);
  return {
    // Strafing is relative to the fighter, who always faces the opponent.
    moveX: axis("left", "right"),
    moveZ: axis("back", "forward"),
    // Attacks are edge-triggered: holding J does not machine-gun jabs.
    punch: pressed.has("punch"),
    kick: pressed.has("kick"),
    special: pressed.has("special"),
    // Block is a held state.
    block: active.has("block"),
  };
}
