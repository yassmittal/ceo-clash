import * as THREE from "three";
import { BONE_NAMES, BONE_OFFSETS, BONE_PARENTS, type BoneName } from "./bones";
import type { CharacterDef } from "@/game/types";

/**
 * Builds the placeholder fighter: a real bone hierarchy with chunky body-part
 * meshes parented to the bones.
 *
 * This is deliberately NOT "rotate the arm mesh in JavaScript". Every pose in the
 * game is produced by an AnimationMixer playing AnimationClips against these
 * bones, exactly as it would with a Mixamo-rigged GLB. Swapping in a real model
 * later means deleting this file and calling `useGLTF` — the Animator, the state
 * machine and the combat code do not change.
 */

export interface Rig {
  /** Root group to add to the scene. Mixer root. */
  root: THREE.Group;
  bones: Record<BoneName, THREE.Bone>;
  /** Every material on the body, so hit flashes can tint the whole fighter. */
  materials: THREE.MeshStandardMaterial[];
  /** Everything that needs disposing when the fighter unmounts. */
  disposables: Array<THREE.BufferGeometry | THREE.Material>;
  /** The head bone, handy for effects. */
  head: THREE.Bone;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

function limb(radius: number, length: number) {
  return new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 4, 10);
}

export function buildRig(def: CharacterDef): Rig {
  const root = new THREE.Group();
  root.name = `rig_${def.id}`;

  const bones = {} as Record<BoneName, THREE.Bone>;
  for (const name of BONE_NAMES) {
    const bone = new THREE.Bone();
    bone.name = name;
    const [x, y, z] = BONE_OFFSETS[name];
    bone.position.set(x, y, z);
    bones[name] = bone;
  }
  for (const name of BONE_NAMES) {
    const parent = BONE_PARENTS[name];
    if (parent) bones[parent].add(bones[name]);
    else root.add(bones[name]);
  }

  const disposables: Rig["disposables"] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.05,
      // A whisper of self-illumination keeps the fighters readable against a
      // deliberately dark arena; the hit flash rides on the same channel.
      emissive: new THREE.Color(color).multiplyScalar(0.18),
      ...opts,
    });
    // Remembered so the hit flash can add on top of it and restore cleanly.
    m.userData.baseEmissive = m.emissive.clone();
    disposables.push(m);
    materials.push(m);
    return m;
  };

  const skin = mat(def.colors.skin);
  const shirt = mat(def.colors.primary);
  const pants = mat(def.colors.secondary);
  const accent = mat(def.colors.accent, { roughness: 0.3, metalness: 0.25 });
  const dark = mat("#1a1d24");

  const attach = (
    bone: BoneName,
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    pos: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0],
  ) => {
    disposables.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    bones[bone].add(mesh);
    return mesh;
  };

  // --- torso -------------------------------------------------------------
  attach("Hips", box(0.42, 0.26, 0.3), pants, [0, -0.03, 0]);
  attach("Chest", box(0.52, 0.42, 0.34), shirt, [0, 0.08, 0]);
  attach("Chest", box(0.54, 0.1, 0.36), accent, [0, -0.1, 0]); // belt-ish trim
  attach("Neck", box(0.15, 0.1, 0.15), skin, [0, 0.03, 0]);

  // --- head: intentionally oversized, this is a brainrot game -------------
  attach("Head", box(0.44, 0.42, 0.4), skin, [0, 0.2, 0]);
  // hair / cap
  attach(
    "Head",
    box(0.47, 0.13, 0.43),
    mat(def.id === "sam" ? "#6b5442" : "#2f2a28"),
    [0, 0.4, 0],
  );
  // eyes
  const eyeGeo = new THREE.SphereGeometry(0.045, 10, 8);
  disposables.push(eyeGeo);
  for (const x of [0.1, -0.1]) {
    const eye = new THREE.Mesh(eyeGeo, dark);
    eye.position.set(x, 0.24, 0.2);
    bones.Head.add(eye);
  }
  // mouth
  attach("Head", box(0.16, 0.035, 0.02), dark, [0, 0.1, 0.205]);
  if (def.id === "dario") {
    // glasses, so the two silhouettes read differently at a glance
    attach("Head", box(0.34, 0.03, 0.03), dark, [0, 0.27, 0.21]);
  }

  // --- arms --------------------------------------------------------------
  for (const s of ["Left", "Right"] as const) {
    attach(`${s}Arm` as BoneName, limb(0.1, 0.32), shirt, [0, -0.14, 0]);
    attach(`${s}ForeArm` as BoneName, limb(0.088, 0.3), skin, [0, -0.13, 0]);
    attach(`${s}Hand` as BoneName, box(0.17, 0.18, 0.17), accent, [0, -0.06, 0]);
  }

  // --- legs --------------------------------------------------------------
  for (const s of ["Left", "Right"] as const) {
    attach(`${s}UpLeg` as BoneName, limb(0.135, 0.46), pants, [0, -0.21, 0]);
    attach(`${s}Leg` as BoneName, limb(0.115, 0.44), pants, [0, -0.2, 0]);
    attach(`${s}Foot` as BoneName, box(0.19, 0.12, 0.32), dark, [0, -0.05, 0.06]);
  }

  return { root, bones, materials, disposables, head: bones.Head };
}

export function disposeRig(rig: Rig) {
  for (const d of rig.disposables) d.dispose();
}
