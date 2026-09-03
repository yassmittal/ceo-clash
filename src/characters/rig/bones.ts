/**
 * The humanoid skeleton definition.
 *
 * Bone names match Mixamo's naming (minus the `mixamorig:` prefix) on purpose:
 * when real Sam/Dario GLBs arrive in Phase 9, the animation clips baked into
 * those files address exactly these bones, so the state machine, the clip names
 * and the mixer code all keep working unchanged. Only the *mesh* is replaced.
 */

export const BONE_NAMES = [
  "Hips",
  "Spine",
  "Chest",
  "Neck",
  "Head",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
] as const;

export type BoneName = (typeof BONE_NAMES)[number];

/** Local offset of each bone from its parent, in metres. Hips is the root. */
export const BONE_OFFSETS: Record<BoneName, [number, number, number]> = {
  Hips: [0, 0.95, 0],
  Spine: [0, 0.14, 0],
  Chest: [0, 0.18, 0],
  Neck: [0, 0.2, 0],
  Head: [0, 0.11, 0],

  LeftShoulder: [0.11, 0.13, 0],
  LeftArm: [0.09, 0, 0],
  LeftForeArm: [0, -0.27, 0],
  LeftHand: [0, -0.25, 0],

  RightShoulder: [-0.11, 0.13, 0],
  RightArm: [-0.09, 0, 0],
  RightForeArm: [0, -0.27, 0],
  RightHand: [0, -0.25, 0],

  LeftUpLeg: [0.12, -0.07, 0],
  LeftLeg: [0, -0.42, 0],
  LeftFoot: [0, -0.4, 0],

  RightUpLeg: [-0.12, -0.07, 0],
  RightLeg: [0, -0.42, 0],
  RightFoot: [0, -0.4, 0],
};

export const BONE_PARENTS: Record<BoneName, BoneName | null> = {
  Hips: null,
  Spine: "Hips",
  Chest: "Spine",
  Neck: "Chest",
  Head: "Neck",

  LeftShoulder: "Chest",
  LeftArm: "LeftShoulder",
  LeftForeArm: "LeftArm",
  LeftHand: "LeftForeArm",

  RightShoulder: "Chest",
  RightArm: "RightShoulder",
  RightForeArm: "RightArm",
  RightHand: "RightForeArm",

  LeftUpLeg: "Hips",
  LeftLeg: "LeftUpLeg",
  LeftFoot: "LeftLeg",

  RightUpLeg: "Hips",
  RightLeg: "RightUpLeg",
  RightFoot: "RightLeg",
};

/** Rest height of the head, used for name tags and camera framing. */
export const FIGHTER_HEIGHT = 1.72;
