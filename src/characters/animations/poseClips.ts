import * as THREE from "three";
import { BONE_OFFSETS, type BoneName } from "@/characters/rig/bones";

/**
 * A tiny keyframe-authoring layer.
 *
 * Poses are written as readable euler angles in DEGREES per bone; this module
 * turns a list of `{ time, pose }` frames into real THREE.AnimationClips made of
 * QuaternionKeyframeTracks on the bones (plus an optional position track on the
 * hips). The runtime therefore never touches a bone directly — an AnimationMixer
 * plays clips, which is exactly the setup a Mixamo GLB gives you.
 */

export type Pose = Partial<Record<BoneName, [number, number, number]>> & {
  /** Absolute hips position, in metres. Defaults to the rest position. */
  pos?: [number, number, number];
};

export interface Frame {
  t: number;
  pose: Pose;
}

const DEG = Math.PI / 180;
const REST_HIPS = BONE_OFFSETS.Hips;

const quat = (e: [number, number, number]) => {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(e[0] * DEG, e[1] * DEG, e[2] * DEG, "XYZ"),
  );
  return [q.x, q.y, q.z, q.w];
};

/**
 * Build a clip. `base` is merged under every frame so each frame is a complete
 * pose — that keeps unmentioned bones from snapping to identity mid-clip.
 */
export function buildClip(name: string, base: Pose, frames: Frame[]): THREE.AnimationClip {
  const times = frames.map((f) => f.t);
  const merged = frames.map((f) => ({ ...base, ...f.pose }));

  // Every bone touched anywhere in this clip (or in the base stance) gets a track.
  const boneSet = new Set<BoneName>();
  for (const pose of merged) {
    for (const key of Object.keys(pose)) {
      if (key !== "pos") boneSet.add(key as BoneName);
    }
  }

  const tracks: THREE.KeyframeTrack[] = [];
  for (const bone of boneSet) {
    const values: number[] = [];
    for (const pose of merged) values.push(...quat(pose[bone] ?? [0, 0, 0]));
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }

  // Hips translation, so knockdowns/jumps actually move the body.
  const usesPos = merged.some((p) => p.pos);
  if (usesPos) {
    const values: number[] = [];
    for (const pose of merged) values.push(...(pose.pos ?? REST_HIPS));
    tracks.push(new THREE.VectorKeyframeTrack("Hips.position", times, values));
  }

  const clip = new THREE.AnimationClip(name, times[times.length - 1], tracks);
  return clip;
}
