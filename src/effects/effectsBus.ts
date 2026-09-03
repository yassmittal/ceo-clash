import * as THREE from "three";

/**
 * A one-frame queue between the simulation and the visual effects.
 *
 * The combat system does not know that particles exist; it just posts a burst.
 * The ParticleField drains the queue during its own frame callback.
 */
export type BurstKind = "hit" | "heavy" | "block" | "special";

export interface Burst {
  position: THREE.Vector3;
  color: THREE.Color;
  power: number;
  kind: BurstKind;
}

const queue: Burst[] = [];

const COLORS: Record<BurstKind, string> = {
  hit: "#ffe066",
  heavy: "#ff7a45",
  block: "#7ee0ff",
  special: "#ff3ce0",
};

export function spawnBurst(kind: BurstKind, position: THREE.Vector3, power = 1) {
  queue.push({
    position: position.clone(),
    color: new THREE.Color(COLORS[kind]),
    power,
    kind,
  });
}

export function drainBursts(): Burst[] {
  if (queue.length === 0) return queue;
  return queue.splice(0, queue.length);
}
