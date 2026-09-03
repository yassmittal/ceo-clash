import * as THREE from "three";
import type { AnimState } from "@/game/types";

const LOOPING: AnimState[] = ["IDLE", "WALK", "RUN", "BLOCK", "VICTORY"];

export interface PlayOptions {
  /** Crossfade duration in seconds. */
  fade?: number;
  /** Playback rate. Negative plays the clip backwards (used for walking back). */
  timeScale?: number;
  /** Force the clip to restart even if it is already the current state. */
  restart?: boolean;
}

/**
 * Thin wrapper over THREE.AnimationMixer.
 *
 * The gameplay layer only ever says "be in state X"; this class owns clip
 * selection, crossfading and loop/clamp behaviour. Because the interface is
 * `play(AnimState)`, the same Animator drives the placeholder rig today and a
 * Mixamo-rigged GLB later — you only change where the clips come from.
 */
export class Animator {
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private _current: AnimState = "IDLE";

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip);
      const looping = LOOPING.includes(clip.name as AnimState);
      action.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = !looping;
      this.actions.set(clip.name, action);
    }
    const idle = this.actions.get("IDLE");
    idle?.play();
  }

  get current(): AnimState {
    return this._current;
  }

  /** Normalised progress through the current clip, 0..1. */
  progress(): number {
    const action = this.actions.get(this._current);
    if (!action) return 0;
    const duration = action.getClip().duration || 1;
    return Math.min(1, action.time / duration);
  }

  play(state: AnimState, opts: PlayOptions = {}) {
    const { fade = 0.12, timeScale = 1, restart = false } = opts;
    const next = this.actions.get(state);
    if (!next) return;

    if (state === this._current && !restart) {
      next.timeScale = timeScale;
      return;
    }

    const prev = this.actions.get(this._current);
    next.reset();
    next.timeScale = timeScale;
    next.setEffectiveWeight(1);
    next.enabled = true;
    next.play();

    if (prev && prev !== next) {
      // Fading the outgoing action out keeps limbs from teleporting between poses.
      next.crossFadeFrom(prev, fade, false);
    } else if (fade > 0) {
      next.fadeIn(fade);
    }

    this._current = state;
  }

  /** Jump the current clip to an absolute time (used by the counter-special). */
  seek(time: number) {
    const action = this.actions.get(this._current);
    if (action) action.time = time;
  }

  update(dt: number) {
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot() as THREE.Object3D);
    this.actions.clear();
  }
}
