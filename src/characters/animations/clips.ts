import type * as THREE from "three";
import { buildClip, type Pose } from "./poseClips";
import type { CharacterDef } from "@/game/types";

/**
 * The animation library.
 *
 * One clip per AnimState. Clip lengths are matched to the frame data in
 * combat/moves.ts, so the impact pose really does land on the active frames —
 * that is what makes a punch feel like it connects rather than like a lookup
 * table firing somewhere behind the art.
 *
 *   PUNCH   0.35s   impact at ~0.13   (startup .09 + active .07)
 *   KICK    0.65s   impact at ~0.24   (startup .19 + active .10)
 *   SPECIAL 1.12s   impact at ~0.42   (startup .34 + active .16)
 */

/** The fighting stance everything else is authored against. */
const STANCE: Pose = {
  Hips: [0, 16, 0],
  Spine: [4, -6, 0],
  Chest: [-2, -10, 0],
  Neck: [2, 0, 0],
  Head: [0, 10, 0],

  // Elbows are kept wide: with chunky limbs a tight guard buries the forearms
  // inside the chest from the side-on fighting camera.
  LeftShoulder: [0, 0, -10],
  LeftArm: [-54, 0, 26],
  LeftForeArm: [-74, -16, 0],
  LeftHand: [0, 0, 0],

  RightShoulder: [0, 0, 10],
  RightArm: [-44, 0, -28],
  RightForeArm: [-70, 18, 0],
  RightHand: [0, 0, 0],

  LeftUpLeg: [-14, 0, 7],
  LeftLeg: [16, 0, 0],
  LeftFoot: [-4, 0, 0],
  RightUpLeg: [12, 0, -7],
  RightLeg: [18, 0, 0],
  RightFoot: [-8, 0, 0],
};

const PRONE: Pose = {
  ...STANCE,
  pos: [0, 0.24, -0.35],
  Hips: [-86, 8, 0],
  Spine: [6, 0, 0],
  Chest: [8, 0, 0],
  Head: [16, 0, 0],
  LeftArm: [-20, 0, 55],
  LeftForeArm: [-30, 0, 0],
  RightArm: [-16, 0, -60],
  RightForeArm: [-25, 0, 0],
  LeftUpLeg: [-24, 0, 16],
  LeftLeg: [40, 0, 0],
  RightUpLeg: [-18, 0, -14],
  RightLeg: [34, 0, 0],
};

function idle(): THREE.AnimationClip {
  return buildClip("IDLE", STANCE, [
    { t: 0, pose: { pos: [0, 0.95, 0] } },
    {
      t: 0.55,
      pose: {
        pos: [0, 0.925, 0],
        Chest: [1, -12, 0],
        Head: [3, 12, 0],
        LeftArm: [-61, 0, 15],
        RightArm: [-43, 0, -18],
        LeftLeg: [20, 0, 0],
        RightLeg: [22, 0, 0],
      },
    },
    {
      t: 1.1,
      pose: {
        pos: [0, 0.945, 0],
        Chest: [-4, -8, 0],
        Head: [-2, 8, 0],
        LeftArm: [-56, 0, 12],
        RightArm: [-48, 0, -14],
      },
    },
    { t: 1.6, pose: { pos: [0, 0.95, 0] } },
  ]);
}

function walk(): THREE.AnimationClip {
  return buildClip("WALK", STANCE, [
    { t: 0, pose: {} },
    {
      t: 0.2,
      pose: {
        pos: [0, 0.965, 0],
        LeftUpLeg: [-38, 0, 7],
        LeftLeg: [30, 0, 0],
        RightUpLeg: [26, 0, -7],
        RightLeg: [12, 0, 0],
        Hips: [0, 22, 0],
        Chest: [-2, -16, 0],
      },
    },
    { t: 0.4, pose: { pos: [0, 0.94, 0] } },
    {
      t: 0.6,
      pose: {
        pos: [0, 0.965, 0],
        LeftUpLeg: [24, 0, 7],
        LeftLeg: [12, 0, 0],
        RightUpLeg: [-36, 0, -7],
        RightLeg: [32, 0, 0],
        Hips: [0, 10, 0],
        Chest: [-2, -4, 0],
      },
    },
    { t: 0.8, pose: { pos: [0, 0.95, 0] } },
  ]);
}

function run(): THREE.AnimationClip {
  return buildClip("RUN", STANCE, [
    { t: 0, pose: { pos: [0, 0.95, 0], Spine: [10, -6, 0] } },
    {
      t: 0.14,
      pose: {
        pos: [0, 1.0, 0],
        Spine: [12, -6, 0],
        LeftUpLeg: [-58, 0, 7],
        LeftLeg: [46, 0, 0],
        RightUpLeg: [40, 0, -7],
        RightLeg: [26, 0, 0],
        LeftArm: [-72, 0, 14],
        RightArm: [-28, 0, -16],
      },
    },
    { t: 0.28, pose: { pos: [0, 0.93, 0], Spine: [14, -6, 0] } },
    {
      t: 0.42,
      pose: {
        pos: [0, 1.0, 0],
        Spine: [12, -6, 0],
        LeftUpLeg: [38, 0, 7],
        LeftLeg: [24, 0, 0],
        RightUpLeg: [-56, 0, -7],
        RightLeg: [48, 0, 0],
        LeftArm: [-30, 0, 14],
        RightArm: [-70, 0, -16],
      },
    },
    { t: 0.56, pose: { pos: [0, 0.95, 0], Spine: [10, -6, 0] } },
  ]);
}

function punch(): THREE.AnimationClip {
  return buildClip("PUNCH", STANCE, [
    { t: 0, pose: {} },
    {
      // wind-up (startup)
      t: 0.09,
      pose: {
        Hips: [0, 30, 0],
        Chest: [-6, 24, 0],
        RightShoulder: [0, -14, 6],
        RightArm: [-34, 0, -22],
        RightForeArm: [-104, 34, 0],
        LeftArm: [-64, 0, 16],
      },
    },
    {
      // impact
      t: 0.15,
      pose: {
        pos: [0, 0.93, 0],
        Hips: [0, -18, 0],
        Spine: [8, -16, 0],
        Chest: [4, -34, 0],
        Head: [4, -10, 0],
        RightShoulder: [0, 22, 0],
        RightArm: [-96, -14, -6],
        RightForeArm: [-6, 0, 0],
        RightHand: [0, 0, 0],
        LeftArm: [-40, 0, 20],
        LeftForeArm: [-100, -30, 0],
        RightUpLeg: [22, 0, -7],
      },
    },
    {
      t: 0.24,
      pose: {
        Hips: [0, -4, 0],
        Chest: [0, -18, 0],
        RightArm: [-74, -6, -12],
        RightForeArm: [-46, 12, 0],
      },
    },
    { t: 0.35, pose: {} },
  ]);
}

function kick(): THREE.AnimationClip {
  return buildClip("KICK", STANCE, [
    { t: 0, pose: {} },
    {
      // chamber
      t: 0.19,
      pose: {
        pos: [0, 0.98, 0],
        Hips: [0, 26, 0],
        Chest: [-10, -18, 0],
        RightUpLeg: [-62, 0, -18],
        RightLeg: [96, 0, 0],
        LeftUpLeg: [-6, 0, 7],
        LeftLeg: [10, 0, 0],
        LeftArm: [-70, 0, 26],
      },
    },
    {
      // impact — leg extended
      t: 0.25,
      pose: {
        pos: [0, 1.0, 0],
        Hips: [0, -14, 0],
        Spine: [-10, -10, 0],
        Chest: [-16, -26, 0],
        Head: [-6, -8, 0],
        RightUpLeg: [-88, 0, -26],
        RightLeg: [8, 0, 0],
        RightFoot: [-20, 0, 0],
        LeftUpLeg: [4, 0, 7],
        LeftLeg: [14, 0, 0],
        LeftArm: [-96, 0, 40],
        LeftForeArm: [-40, -20, 0],
        RightArm: [-20, 0, -40],
      },
    },
    {
      t: 0.42,
      pose: {
        pos: [0, 0.96, 0],
        Hips: [0, 8, 0],
        RightUpLeg: [-30, 0, -14],
        RightLeg: [50, 0, 0],
        Chest: [-8, -14, 0],
      },
    },
    { t: 0.65, pose: {} },
  ]);
}

function block(): THREE.AnimationClip {
  const guard: Pose = {
    ...STANCE,
    pos: [0, 0.88, 0],
    Hips: [6, 24, 0],
    Spine: [10, -4, 0],
    Chest: [8, -12, 0],
    Head: [10, 6, 0],
    LeftArm: [-92, 0, 38],
    LeftForeArm: [-96, -34, 0],
    RightArm: [-88, 0, -36],
    RightForeArm: [-94, 32, 0],
    LeftUpLeg: [-22, 0, 8],
    LeftLeg: [34, 0, 0],
    RightUpLeg: [18, 0, -8],
    RightLeg: [32, 0, 0],
  };
  return buildClip("BLOCK", guard, [
    { t: 0, pose: {} },
    { t: 0.25, pose: { pos: [0, 0.87, 0], Chest: [10, -12, 0] } },
    { t: 0.5, pose: {} },
  ]);
}

function hit(): THREE.AnimationClip {
  return buildClip("HIT", STANCE, [
    { t: 0, pose: {} },
    {
      t: 0.07,
      pose: {
        pos: [0, 0.93, 0],
        Hips: [-10, 6, 0],
        Spine: [-16, 4, 0],
        Chest: [-24, 8, 0],
        Head: [-34, -14, 0],
        LeftArm: [-30, 0, 44],
        LeftForeArm: [-40, 0, 0],
        RightArm: [-24, 0, -48],
        RightForeArm: [-36, 0, 0],
        LeftUpLeg: [-4, 0, 10],
        RightUpLeg: [22, 0, -10],
      },
    },
    {
      t: 0.18,
      pose: {
        Chest: [-12, 0, 0],
        Head: [-14, 0, 0],
        LeftArm: [-48, 0, 26],
        RightArm: [-38, 0, -30],
      },
    },
    { t: 0.35, pose: {} },
  ]);
}

function knockdown(): THREE.AnimationClip {
  return buildClip("KNOCKDOWN", STANCE, [
    { t: 0, pose: {} },
    {
      t: 0.16,
      pose: {
        pos: [0, 1.12, -0.1],
        Hips: [-38, 4, 0],
        Chest: [-34, 0, 0],
        Head: [-40, 0, 0],
        LeftArm: [10, 0, 70],
        RightArm: [12, 0, -74],
        LeftUpLeg: [-46, 0, 12],
        RightUpLeg: [-38, 0, -12],
        LeftLeg: [56, 0, 0],
        RightLeg: [48, 0, 0],
      },
    },
    {
      t: 0.42,
      pose: {
        pos: [0, 0.6, -0.28],
        Hips: [-74, 6, 0],
        Chest: [-10, 0, 0],
        Head: [-20, 0, 0],
        LeftArm: [-6, 0, 62],
        RightArm: [-4, 0, -66],
        LeftUpLeg: [-52, 0, 14],
        RightUpLeg: [-44, 0, -14],
        LeftLeg: [64, 0, 0],
        RightLeg: [58, 0, 0],
      },
    },
    { t: 0.62, pose: { ...PRONE, pos: [0, 0.2, -0.38] } },
    { t: 0.8, pose: PRONE },
  ]);
}

function getUp(): THREE.AnimationClip {
  return buildClip("GET_UP", STANCE, [
    { t: 0, pose: PRONE },
    {
      t: 0.3,
      pose: {
        ...PRONE,
        pos: [0, 0.38, -0.3],
        Hips: [-58, 8, 0],
        Chest: [22, 0, 0],
        Head: [8, 0, 0],
        LeftUpLeg: [-58, 0, 16],
        LeftLeg: [78, 0, 0],
        RightUpLeg: [-50, 0, -14],
        RightLeg: [72, 0, 0],
      },
    },
    {
      t: 0.62,
      pose: {
        pos: [0, 0.66, -0.14],
        Hips: [-18, 14, 0],
        Spine: [26, -4, 0],
        Chest: [18, -8, 0],
        Head: [-6, 4, 0],
        LeftArm: [-40, 0, 22],
        LeftForeArm: [-70, -20, 0],
        RightArm: [-34, 0, -22],
        RightForeArm: [-66, 20, 0],
        LeftUpLeg: [-72, 0, 14],
        LeftLeg: [92, 0, 0],
        RightUpLeg: [-40, 0, -12],
        RightLeg: [66, 0, 0],
      },
    },
    { t: 0.85, pose: { pos: [0, 0.86, 0], Spine: [12, -6, 0], Chest: [6, -10, 0] } },
    { t: 1.05, pose: {} },
  ]);
}

function victory(): THREE.AnimationClip {
  return buildClip("VICTORY", STANCE, [
    { t: 0, pose: { pos: [0, 0.95, 0] } },
    {
      t: 0.35,
      pose: {
        pos: [0, 1.06, 0],
        Hips: [0, 0, 0],
        Chest: [-8, 0, 0],
        Head: [-14, 0, 0],
        LeftArm: [-10, 0, 150],
        LeftForeArm: [-20, 0, 0],
        RightArm: [-8, 0, -152],
        RightForeArm: [-18, 0, 0],
        LeftUpLeg: [-10, 0, 8],
        RightUpLeg: [-8, 0, -8],
        LeftLeg: [6, 0, 0],
        RightLeg: [6, 0, 0],
      },
    },
    {
      t: 0.7,
      pose: {
        pos: [0, 0.9, 0],
        Hips: [0, 0, 0],
        Chest: [6, 0, 0],
        Head: [8, 0, 0],
        LeftArm: [-14, 0, 132],
        RightArm: [-12, 0, -134],
        LeftUpLeg: [-16, 0, 10],
        RightUpLeg: [-14, 0, -10],
        LeftLeg: [26, 0, 0],
        RightLeg: [26, 0, 0],
      },
    },
    { t: 1.05, pose: { pos: [0, 1.04, 0], Chest: [-6, 0, 0], LeftArm: [-10, 0, 148], RightArm: [-8, 0, -150] } },
    { t: 1.4, pose: { pos: [0, 0.95, 0] } },
  ]);
}

function defeat(): THREE.AnimationClip {
  return buildClip("DEFEAT", STANCE, [
    { t: 0, pose: {} },
    {
      t: 0.25,
      pose: {
        pos: [0, 0.72, -0.1],
        Hips: [-14, 8, 0],
        Chest: [-20, 0, 0],
        Head: [-26, 0, 0],
        LeftArm: [-4, 0, 60],
        RightArm: [-2, 0, -64],
        LeftUpLeg: [-34, 0, 12],
        RightUpLeg: [-30, 0, -12],
        LeftLeg: [58, 0, 0],
        RightLeg: [54, 0, 0],
      },
    },
    { t: 0.55, pose: { ...PRONE, pos: [0, 0.26, -0.3] } },
    { t: 0.9, pose: PRONE },
  ]);
}

/** Sam: a wildly telegraphed overhead haymaker. */
function gptSmash(): THREE.AnimationClip {
  return buildClip("SPECIAL", STANCE, [
    { t: 0, pose: {} },
    {
      t: 0.2,
      pose: {
        pos: [0, 0.99, 0],
        Hips: [0, 44, 0],
        Spine: [-12, 10, 0],
        Chest: [-22, 34, 0],
        Head: [-16, 20, 0],
        RightArm: [30, 0, -40],
        RightForeArm: [-70, 40, 0],
        LeftArm: [-84, 0, 30],
        LeftForeArm: [-70, -30, 0],
        RightUpLeg: [-8, 0, -12],
      },
    },
    {
      // fully cocked, absurdly so
      t: 0.34,
      pose: {
        pos: [0, 1.04, -0.1],
        Hips: [0, 54, 0],
        Spine: [-18, 14, 0],
        Chest: [-30, 42, 0],
        Head: [-22, 26, 0],
        RightShoulder: [0, -26, 10],
        RightArm: [64, 0, -48],
        RightForeArm: [-58, 46, 0],
        LeftArm: [-92, 0, 34],
        LeftUpLeg: [-24, 0, 12],
        RightUpLeg: [-14, 0, -14],
      },
    },
    {
      // IMPACT
      t: 0.42,
      pose: {
        pos: [0, 0.86, 0.16],
        Hips: [10, -34, 0],
        Spine: [22, -22, 0],
        Chest: [26, -46, 0],
        Head: [18, -18, 0],
        RightShoulder: [0, 30, -4],
        RightArm: [-118, -18, -4],
        RightForeArm: [-4, 0, 0],
        LeftArm: [-30, 0, 26],
        LeftForeArm: [-96, -30, 0],
        LeftUpLeg: [-40, 0, 12],
        LeftLeg: [42, 0, 0],
        RightUpLeg: [34, 0, -10],
        RightLeg: [10, 0, 0],
      },
    },
    {
      t: 0.72,
      pose: {
        pos: [0, 0.9, 0.08],
        Hips: [6, -18, 0],
        Chest: [16, -30, 0],
        RightArm: [-96, -10, -10],
        RightForeArm: [-30, 10, 0],
      },
    },
    { t: 1.12, pose: {} },
  ]);
}

/** Dario: a braced parry that answers with an elbow-driven rebuttal. */
function claudeCounter(): THREE.AnimationClip {
  return buildClip("SPECIAL", STANCE, [
    { t: 0, pose: {} },
    {
      // brace — the parry window opens
      t: 0.06,
      pose: {
        pos: [0, 0.86, 0],
        Hips: [10, 30, 0],
        Spine: [14, -6, 0],
        Chest: [12, -16, 0],
        Head: [12, 8, 0],
        LeftArm: [-104, 0, 30],
        LeftForeArm: [-110, -52, 0],
        RightArm: [-100, 0, -28],
        RightForeArm: [-108, 50, 0],
        LeftUpLeg: [-30, 0, 10],
        LeftLeg: [44, 0, 0],
        RightUpLeg: [24, 0, -10],
        RightLeg: [40, 0, 0],
      },
    },
    {
      t: 0.5,
      pose: {
        pos: [0, 0.84, 0],
        Hips: [12, 34, 0],
        Chest: [14, -18, 0],
        LeftArm: [-108, 0, 32],
        LeftForeArm: [-112, -54, 0],
        RightArm: [-104, 0, -30],
        RightForeArm: [-110, 52, 0],
        LeftUpLeg: [-32, 0, 10],
        LeftLeg: [46, 0, 0],
        RightUpLeg: [26, 0, -10],
        RightLeg: [42, 0, 0],
      },
    },
    {
      // rebuttal — elbow through the chest
      t: 0.7,
      pose: {
        pos: [0, 0.98, 0.2],
        Hips: [0, -30, 0],
        Spine: [10, -20, 0],
        Chest: [8, -48, 0],
        Head: [4, -20, 0],
        RightShoulder: [0, 26, 0],
        RightArm: [-104, -30, -18],
        RightForeArm: [-96, 0, 0],
        LeftArm: [-34, 0, 24],
        LeftForeArm: [-92, -28, 0],
        LeftUpLeg: [-44, 0, 12],
        LeftLeg: [36, 0, 0],
        RightUpLeg: [30, 0, -10],
      },
    },
    {
      t: 0.9,
      pose: {
        pos: [0, 0.94, 0.08],
        Hips: [0, -10, 0],
        Chest: [4, -26, 0],
        RightArm: [-86, -14, -16],
        RightForeArm: [-60, 14, 0],
      },
    },
    { t: 1.12, pose: {} },
  ]);
}

/** Every clip a fighter needs, keyed by AnimState name. */
export function buildClips(def: CharacterDef): THREE.AnimationClip[] {
  return [
    idle(),
    walk(),
    run(),
    punch(),
    kick(),
    block(),
    hit(),
    knockdown(),
    getUp(),
    victory(),
    defeat(),
    def.special.kind === "counter" ? claudeCounter() : gptSmash(),
  ];
}
