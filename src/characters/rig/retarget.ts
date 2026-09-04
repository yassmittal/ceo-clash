import * as THREE from "three";
import { MIXAMO_BONE_MAP, REST_CORRECTION } from "./boneMap";
import type { BoneName } from "./bones";

/**
 * Retargets the game's hand-authored clips onto an imported skeleton.
 *
 * The two rigs describe the same poses in different frames of reference:
 *
 *   - The placeholder rig has *identity* rest rotations, so a clip's local
 *     quaternion is effectively a world-space rotation.
 *   - A Mixamo/Tripo rig encodes its T-pose in per-bone rest rotations, and each
 *     bone's local axes are aligned to the bone, not to the world.
 *
 * So a clip value has to be expressed in the target bone's parent frame and then
 * composed with that bone's rest rotation:
 *
 *     q_target = P⁻¹ · q_clip · P · q_rest
 *
 * where P is the parent's accumulated *rest* world rotation. Because both
 * quantities come from the rest pose, they are computed once at load rather than
 * per frame — retargeting costs nothing while the game is running.
 */

export interface RetargetResult {
  clips: THREE.AnimationClip[];
  /** Hip height of the imported rig, used to scale root motion. */
  hipHeight: number;
}

/**
 * Bone names survive import in several forms: glTF stores "mixamorig:Hips", but
 * three.js strips the colon to "mixamorigHips", and a hand-made rig may just say
 * "Hips". Normalising to lowercase alphanumerics minus the vendor prefix makes
 * the lookup work for all of them.
 */
export function normaliseBoneName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^mixamorig/, "");
}

/** Accumulated rest rotation from the skeleton root down to (and including) `obj`. */
function worldRestQuaternion(obj: THREE.Object3D, stopAt: THREE.Object3D): THREE.Quaternion {
  const q = new THREE.Quaternion();
  const chain: THREE.Object3D[] = [];
  let cur: THREE.Object3D | null = obj;
  while (cur && cur !== stopAt.parent) {
    chain.unshift(cur);
    cur = cur.parent;
  }
  for (const node of chain) q.multiply(node.quaternion);
  return q;
}

export function retargetClips(
  clips: THREE.AnimationClip[],
  skeletonRoot: THREE.Object3D,
  sourceHipHeight: number,
  /** Uniform scale applied to the model to bring it to game size. */
  modelScale: number,
): RetargetResult {
  const bones = new Map<string, THREE.Object3D>();
  skeletonRoot.traverse((o) => {
    if (o.name) bones.set(normaliseBoneName(o.name), o);
  });

  const hips = bones.get(normaliseBoneName(MIXAMO_BONE_MAP.Hips));
  if (!hips) {
    throw new Error(
      `retarget: no Hips bone found. Skeleton has: ${[...bones.keys()].slice(0, 12).join(", ")}`,
    );
  }

  // Rest-pose height of the hips, in the skeleton's own space.
  const hipWorld = new THREE.Vector3();
  skeletonRoot.updateWorldMatrix(true, true);
  hips.getWorldPosition(hipWorld);
  const hipHeight = hipWorld.y;

  // Precompute the per-bone correction terms.
  interface Correction {
    target: THREE.Object3D;
    parentRest: THREE.Quaternion;
    rest: THREE.Quaternion;
    /** World-space fix for rigs whose rest pose differs from the placeholder's. */
    restFix: THREE.Quaternion;
  }
  const corrections = new Map<string, Correction>();
  for (const [game, mixamo] of Object.entries(MIXAMO_BONE_MAP) as [BoneName, string][]) {
    const target = bones.get(normaliseBoneName(mixamo));
    if (!target) continue;
    const parentRest = target.parent
      ? worldRestQuaternion(target.parent, skeletonRoot)
      : new THREE.Quaternion();
    corrections.set(game, {
      target,
      parentRest,
      rest: target.quaternion.clone(),
      restFix: REST_CORRECTION[game]?.clone() ?? new THREE.Quaternion(),
    });
  }

  const delta = new THREE.Vector3();
  const scratchClip = new THREE.Quaternion();
  const scratchOut = new THREE.Quaternion();
  const inverseParent = new THREE.Quaternion();

  const out = clips.map((clip) => {
    const tracks: THREE.KeyframeTrack[] = [];

    for (const track of clip.tracks) {
      const [boneName, property] = track.name.split(".");
      const correction = corrections.get(boneName);
      if (!correction) continue; // a bone this skeleton does not have

      inverseParent.copy(correction.parentRest).invert();

      if (property === "quaternion") {
        const values = new Float32Array(track.values.length);
        for (let i = 0; i < track.values.length; i += 4) {
          scratchClip.set(
            track.values[i],
            track.values[i + 1],
            track.values[i + 2],
            track.values[i + 3],
          );
          // P⁻¹ · q · A · P · rest
          //   P    puts the clip value into the target bone's parent frame
          //   A    reconciles the two rigs' different rest poses
          //   rest re-applies the bone's own rest rotation
          scratchOut
            .copy(inverseParent)
            .multiply(scratchClip)
            .multiply(correction.restFix)
            .multiply(correction.parentRest)
            .multiply(correction.rest);
          values[i] = scratchOut.x;
          values[i + 1] = scratchOut.y;
          values[i + 2] = scratchOut.z;
          values[i + 3] = scratchOut.w;
        }
        tracks.push(
          new THREE.QuaternionKeyframeTrack(`${correction.target.name}.quaternion`, Array.from(track.times), Array.from(values)),
        );
      } else if (property === "position" && boneName === "Hips") {
        // Root motion needs rotating, not copying. The clip's hip offsets are in
        // world axes (the placeholder rig is world-aligned), but an imported
        // skeleton usually is not — this one is Z-up internally, so writing the
        // clip's Y straight into the bone flattened the character to knee height.
        //
        // So: take the offset from the placeholder's rest hips, rotate it into
        // the target hips' parent frame, and add it to the target's own rest.
        const rest = correction.target.position;
        const values = new Float32Array(track.values.length);
        // Generated characters are chibi-proportioned: shorter legs, bigger head,
        // so their hips sit lower than the placeholder's. A knockdown authored as
        // "drop 0.71m" would put them through the floor, so the offset is scaled
        // by the ratio of hip heights — it drops the same *fraction* of leg length.
        const proportion = hipHeight / sourceHipHeight;
        for (let i = 0; i < track.values.length; i += 3) {
          delta
            .set(
              track.values[i],
              track.values[i + 1] - sourceHipHeight,
              track.values[i + 2],
            )
            .multiplyScalar(proportion / modelScale)
            .applyQuaternion(inverseParent);
          values[i] = rest.x + delta.x;
          values[i + 1] = rest.y + delta.y;
          values[i + 2] = rest.z + delta.z;
        }
        tracks.push(
          new THREE.VectorKeyframeTrack(`${correction.target.name}.position`, Array.from(track.times), Array.from(values)),
        );
      }
    }

    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  });

  return { clips: out, hipHeight };
}
