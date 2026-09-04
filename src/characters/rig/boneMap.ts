import * as THREE from "three";
import type { BoneName } from "./bones";

/**
 * Maps the game's bone names onto the skeleton Tripo's auto-rigger produces.
 *
 * Tripo emits a Mixamo-spec skeleton, which is why this map is almost an
 * identity function with a prefix — the placeholder rig was named to match
 * Mixamo from the start precisely so this step would be trivial.
 *
 * The only real difference is the spine: the game has Hips -> Spine -> Chest,
 * Mixamo has Hips -> Spine -> Spine1 -> Spine2. The game's "Chest" drives
 * Spine2 (the bone the shoulders hang off), and Spine1 is left at rest.
 */
export const MIXAMO_BONE_MAP: Record<BoneName, string> = {
  Hips: "mixamorig:Hips",
  Spine: "mixamorig:Spine",
  Chest: "mixamorig:Spine2",
  Neck: "mixamorig:Neck",
  Head: "mixamorig:Head",

  LeftShoulder: "mixamorig:LeftShoulder",
  LeftArm: "mixamorig:LeftArm",
  LeftForeArm: "mixamorig:LeftForeArm",
  LeftHand: "mixamorig:LeftHand",

  RightShoulder: "mixamorig:RightShoulder",
  RightArm: "mixamorig:RightArm",
  RightForeArm: "mixamorig:RightForeArm",
  RightHand: "mixamorig:RightHand",

  LeftUpLeg: "mixamorig:LeftUpLeg",
  LeftLeg: "mixamorig:LeftLeg",
  LeftFoot: "mixamorig:LeftFoot",

  RightUpLeg: "mixamorig:RightUpLeg",
  RightLeg: "mixamorig:RightLeg",
  RightFoot: "mixamorig:RightFoot",
};


/**
 * Rest-pose corrections, in world space.
 *
 * The two rigs do not merely *encode* their rest poses differently — they are
 * different poses. The placeholder stands with its arms hanging down; a Mixamo
 * rig stands in a T-pose with the arms straight out. A clip authored against
 * arms-down would otherwise swing the arms up from horizontal.
 *
 * Only the upper arms need fixing. Forearms, hands and the whole leg chain point
 * "straight on from the parent" in both rigs, so they inherit the correction and
 * need none of their own; the spine is upright in both.
 */
const HALF_PI = Math.PI / 2;

export const REST_CORRECTION: Partial<Record<BoneName, THREE.Quaternion>> = {
  // T-pose left arm points +X (the character's left); ours points -Y (down).
  LeftArm: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -HALF_PI),
  // T-pose right arm points -X; ours points -Y.
  RightArm: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), HALF_PI),
};
