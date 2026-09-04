import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { GLTF } from "three-stdlib";
import type { CharacterDef } from "@/game/types";
import { normaliseBoneName, retargetClips } from "./retarget";
import { BONE_OFFSETS, FIGHTER_HEIGHT } from "./bones";
import type { Rig } from "./buildRig";

/**
 * Turns a loaded GLB into the same `Rig` shape the procedural builder returns,
 * so `Fighter.tsx` does not care which one it is holding.
 *
 * Three things have to be normalised, because a generated model arrives in
 * whatever scale and orientation the generator felt like:
 *
 *   1. Height — scaled so the fighter matches the physics capsule.
 *   2. Facing — the game drives yaw itself and assumes the model faces +Z.
 *   3. Materials — cloned per fighter, so the hit flash on one does not
 *      light up the other.
 */

/** Hip height of the placeholder rig; the reference for scaling root motion. */
const SOURCE_HIP_HEIGHT = BONE_OFFSETS.Hips[1];

export interface GltfRig extends Omit<Rig, "bones"> {
  clips: THREE.AnimationClip[];
  bones: Record<string, THREE.Object3D>;
}

/**
 * Generated models come with mitten hands — no fingers, flat paddles. That is a
 * limitation of AI 3D generation, not of the optimisation step: the raw 282k
 * triangle mesh has exactly the same hands.
 *
 * So we cover them. Gloves read as deliberate in a fighting game, hide the
 * weakest part of the model, and make the fists legible at the moment they
 * matter — the frame a punch lands.
 */
function addGloves(bones: Record<string, THREE.Object3D>, def: CharacterDef, rig: {
  materials: THREE.MeshStandardMaterial[];
  disposables: Rig["disposables"];
}) {
  const glove = new THREE.MeshStandardMaterial({
    // The fighter's own colour, so whose fist just landed is readable at speed.
    color: def.colors.primary,
    roughness: 0.42,
    metalness: 0.05,
  });
  glove.userData.baseEmissive = glove.emissive.clone();
  rig.materials.push(glove);
  rig.disposables.push(glove);

  const cuff = new THREE.MeshStandardMaterial({
    color: def.colors.secondary,
    roughness: 0.6,
  });
  cuff.userData.baseEmissive = cuff.emissive.clone();
  rig.materials.push(cuff);
  rig.disposables.push(cuff);

  // Big enough to swallow the mitten entirely — and big gloves suit the style.
  const geo = new THREE.SphereGeometry(0.105, 16, 12);
  geo.scale(1.0, 1.0, 0.92);
  const cuffGeo = new THREE.CylinderGeometry(0.062, 0.07, 0.055, 14);
  rig.disposables.push(geo, cuffGeo);

  for (const side of ["Left", "Right"]) {
    const hand = bones[`mixamorig${side}Hand`];
    const forearm = bones[`mixamorig${side}ForeArm`];
    if (!hand || !forearm) continue;

    hand.updateWorldMatrix(true, false);

    // Do not assume the hand bone's +Y runs along the hand — it does not on
    // every rig. Take the forearm -> hand direction, which always does, and
    // convert it into the hand's own local space.
    const handWorld = hand.getWorldPosition(new THREE.Vector3());
    const foreWorld = forearm.getWorldPosition(new THREE.Vector3());
    const ahead = handWorld.clone().add(handWorld.clone().sub(foreWorld).normalize());
    const dir = hand.worldToLocal(ahead).normalize();

    // Bones inherit the model's own scale; this wrapper undoes it so the glove
    // can be sized in real metres regardless of how the model was authored.
    const worldScale = hand.getWorldScale(new THREE.Vector3());
    const wrapper = new THREE.Group();
    wrapper.scale.setScalar(1 / (worldScale.x || 1));
    // worldToLocal already divided by the bone scale; undo that for the offset.
    const reach = dir.clone().multiplyScalar(0.045 * (worldScale.x || 1));

    const mesh = new THREE.Mesh(geo, glove);
    mesh.position.copy(reach);
    mesh.castShadow = true;
    wrapper.add(mesh);

    const band = new THREE.Mesh(cuffGeo, cuff);
    band.position.copy(reach).multiplyScalar(-0.55);
    wrapper.add(band);

    hand.add(wrapper);
  }
}

export function buildGltfRig(
  gltf: GLTF,
  sourceClips: THREE.AnimationClip[],
  def: CharacterDef,
): GltfRig {
  // SkeletonUtils.clone (not Object3D.clone) — skinned meshes need their
  // skeleton rebound, or both fighters share one pose.
  const root = cloneSkinned(gltf.scene) as THREE.Group;

  const disposables: Rig["disposables"] = [];
  const materials: THREE.MeshStandardMaterial[] = [];

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
    mesh.castShadow = true;
    mesh.frustumCulled = false; // skinned bounds go stale during big animations
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = list.map((m) => {
      const c = (m as THREE.MeshStandardMaterial).clone();
      c.userData.baseEmissive = c.emissive.clone();
      disposables.push(c);
      materials.push(c);
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
  });

  // --- 1. normalise height ------------------------------------------------
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 0.001 ? FIGHTER_HEIGHT / size.y : 1;

  // --- 2. normalise facing -------------------------------------------------
  // Rather than guess from the bounding box, ask the skeleton: toes point
  // forwards, so the foot->toe vector is the character's facing direction. The
  // game drives yaw itself and assumes the model looks down +Z.
  const holder = new THREE.Group();
  holder.add(root);
  holder.scale.setScalar(scale);
  holder.rotation.y = -facingOffset(root);

  // Drop the model so its feet sit on y = 0, matching the placeholder rig.
  holder.updateWorldMatrix(true, true);
  const scaledBox = new THREE.Box3().setFromObject(holder);
  holder.position.y = -scaledBox.min.y;

  // --- 3. retarget the clips ----------------------------------------------
  // Retarget against the *holder*, not the raw scene: the clips are authored in
  // game space (forward +Z), and the holder's yaw correction is what maps the
  // skeleton's own space onto it. Leaving it out silently cancels the arm poses.
  holder.updateWorldMatrix(true, true);
  const { clips } = retargetClips(sourceClips, holder, SOURCE_HIP_HEIGHT, scale);

  const bones: Record<string, THREE.Object3D> = {};
  root.traverse((o) => {
    if (o.name) bones[o.name] = o;
  });

  addGloves(bones, def, { materials, disposables });

  const head = bones.mixamorigHead ?? bones["mixamorig:Head"] ?? bones.Head ?? root;

  return {
    root: holder,
    bones,
    materials,
    disposables,
    clips,
    head: head as THREE.Bone,
  };
}

/**
 * The yaw, in radians, that the model is currently facing — measured from the
 * feet. Falls back to the bounding box for a skeleton with no toe bones.
 */
function facingOffset(root: THREE.Object3D): number {
  const bones = new Map<string, THREE.Object3D>();
  root.traverse((o) => {
    if (o.name) bones.set(normaliseBoneName(o.name), o);
  });
  root.updateWorldMatrix(true, true);

  const forward = new THREE.Vector3();
  let samples = 0;
  for (const side of ["left", "right"]) {
    const foot = bones.get(`${side}foot`);
    const toe = bones.get(`${side}toebase`);
    if (!foot || !toe) continue;
    const a = foot.getWorldPosition(new THREE.Vector3());
    const b = toe.getWorldPosition(new THREE.Vector3());
    forward.add(b.sub(a));
    samples++;
  }
  if (samples === 0) return 0;
  forward.y = 0;
  if (forward.lengthSq() < 1e-8) return 0;
  forward.normalize();
  return Math.atan2(forward.x, forward.z);
}

/** Where the game looks for generated models. */
export const modelPath = (id: string) => `/models/${id}.glb`;
