import type { Intent } from "@/game/types";
import { emptyIntent } from "@/game/types";
import {
  DEFAULT_KEYMAP,
  intentFromActions,
  loadKeymap,
  type ActionName,
  type KeyMap,
} from "./keymap";

/**
 * Collects raw key events into a per-frame Intent.
 *
 * `pressed` holds edge-triggered actions (attacks) and is cleared every time the
 * simulation reads it, so an attack fires exactly once per keypress regardless of
 * frame rate.
 */
export class InputManager {
  private keymap: KeyMap = { ...DEFAULT_KEYMAP };
  private active = new Set<ActionName>();
  private pressed = new Set<ActionName>();
  private attached = false;

  attach() {
    if (this.attached) return;
    this.keymap = loadKeymap();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.attached = true;
  }

  detach() {
    if (!this.attached) return;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.active.clear();
    this.pressed.clear();
    this.attached = false;
  }

  setKeymap(map: KeyMap) {
    this.keymap = map;
  }

  getKeymap() {
    return this.keymap;
  }

  /** Reads and clears the frame's input. */
  consume(): Intent {
    if (!this.attached) return emptyIntent();
    const intent = intentFromActions(this.active, this.pressed);
    this.pressed.clear();
    return intent;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const action = this.keymap[e.code];
    if (!action) return;
    // Stop SPACE/arrows from scrolling the page mid-fight.
    e.preventDefault();
    if (e.repeat) return;
    this.active.add(action);
    this.pressed.add(action);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const action = this.keymap[e.code];
    if (!action) return;
    this.active.delete(action);
  };

  /** Losing focus mid-hold would otherwise leave the fighter stuck walking. */
  private onBlur = () => {
    this.active.clear();
    this.pressed.clear();
  };
}

export const input = new InputManager();
