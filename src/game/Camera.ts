import * as THREE from "three";
import { fight } from "@/game/runtime";

/**
 * Third-person fighting-game camera.
 *
 * It watches the midpoint between the fighters from the side, dollies out as
 * they separate, and shakes on impact. Keeping a persistent "side" vector and
 * choosing the nearer sign of it stops the camera from whipping 180 degrees the
 * moment the fighters cross over each other.
 */

const mid = new THREE.Vector3();
const axis = new THREE.Vector3();
const side = new THREE.Vector3(0, 0, 1);
const desiredSide = new THREE.Vector3();
const target = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const shake = new THREE.Vector3();

const MIN_DISTANCE = 4.8;
const MAX_DISTANCE = 9.2;

let initialised = false;

export function resetCamera() {
  initialised = false;
  side.set(0, 0, 1);
}

/** Frame-rate independent smoothing. */
const damp = (current: number, goal: number, lambda: number, dt: number) =>
  THREE.MathUtils.lerp(current, goal, 1 - Math.exp(-lambda * dt));

export function updateCamera(
  camera: THREE.PerspectiveCamera,
  dt: number,
  opts: { closeUp?: boolean } = {},
) {
  const a = fight.player;
  const b = fight.opponent;
  if (!a || !b) return;

  mid.addVectors(a.position, b.position).multiplyScalar(0.5);
  axis.subVectors(b.position, a.position).setY(0);
  const separation = axis.length();
  if (separation > 1e-4) axis.divideScalar(separation);
  else axis.set(1, 0, 0);

  // Perpendicular to the line between the fighters.
  desiredSide.set(axis.z, 0, -axis.x);
  if (desiredSide.dot(side) < 0) desiredSide.negate();
  side.lerp(desiredSide, 1 - Math.exp(-4 * dt)).normalize();

  const closeUp = opts.closeUp ?? false;
  const distance =
    THREE.MathUtils.clamp(3.7 + separation * 0.85, MIN_DISTANCE, MAX_DISTANCE) *
    (closeUp ? 0.78 : 1);
  const height = (1.9 + separation * 0.1) * (closeUp ? 0.85 : 1);

  target.copy(mid).addScaledVector(side, distance).setY(height);
  // A touch of offset along the fighter axis stops a dead-flat side-on view.
  target.addScaledVector(axis, separation * 0.06);

  if (!initialised) {
    camera.position.copy(target);
    initialised = true;
  } else {
    const lambda = closeUp ? 3.5 : 6;
    camera.position.set(
      damp(camera.position.x, target.x, lambda, dt),
      damp(camera.position.y, target.y, lambda, dt),
      damp(camera.position.z, target.z, lambda, dt),
    );
  }

  // --- shake ------------------------------------------------------------
  const trauma = fight.trauma;
  if (trauma > 0.001) {
    const t = trauma * trauma; // quadratic falloff reads as a punch, not a wobble
    const amp = 0.55 * t;
    shake.set(
      (Math.random() * 2 - 1) * amp,
      (Math.random() * 2 - 1) * amp,
      (Math.random() * 2 - 1) * amp * 0.5,
    );
    camera.position.add(shake);
  }

  lookAt.copy(mid).setY(mid.y + (closeUp ? 0.1 : 0.28));
  camera.lookAt(lookAt);
  if (trauma > 0.001) camera.rotateZ((Math.random() * 2 - 1) * 0.05 * trauma * trauma);
}
