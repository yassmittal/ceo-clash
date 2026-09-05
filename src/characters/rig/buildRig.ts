import * as THREE from "three";
import { BONE_NAMES, BONE_OFFSETS, BONE_PARENTS, type BoneName } from "./bones";
import { faceTexture } from "./faces";
import { type GearId, loadGear } from "./gear";
import { loadHead } from "./heads";
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
  /** The parts of the rig that are not known yet when buildRig returns. */
  live: RigLive;
}

export interface RigLive {
  /** Cleared by disposeRig, so a head that finishes loading after the fighter
   *  unmounted does not attach itself to a rig that is already torn down. */
  alive: boolean;
  /**
   * The 3D head, once it has loaded — null while the blocky fallback is up.
   *
   * The director yaws this *mesh*, never the Head bone, and that distinction
   * matters: three's PropertyMixer only writes an animated value back to the
   * scene graph when it has changed since the previous frame (see
   * PropertyMixer.apply). The Head track is a constant in WALK and RUN, which
   * inherit it unchanged from STANCE, so a fighter on the move has a Head bone
   * the mixer stops touching entirely — and anything added to that bone
   * per-frame compounds instead of being reset. The mesh is ours alone, so
   * assigning its rotation is idempotent by construction.
   */
  headMesh: THREE.Object3D | null;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

type Side = "Left" | "Right";
/** Iterated in this order everywhere, so index 0 is always the left side. */
const SIDES: readonly Side[] = ["Left", "Right"];

/**
 * How the 3D head is fitted to the skeleton.
 *
 * The model is one unit tall from the base of its neck stub to the crown, so
 * HEAD_HEIGHT is that whole span in metres and HEAD_DROP lowers the stub below
 * the Head bone until it disappears into the top of the chest block (which ends
 * at y=1.56, with the Head bone at y=1.58). Slightly larger than an anatomical
 * head against this body on purpose — the blocky fighters were always
 * caricatures and a correctly-scaled head reads as a pinhead on them.
 */
const HEAD_HEIGHT = 0.6;
const HEAD_DROP = -0.08;

/**
 * How the gloves and shoes are fitted.
 *
 * The glove model is one unit from cuff to fist and hangs off its cuff, so
 * GLOVE_LENGTH is that span and GLOVE_RISE lifts the cuff a little above the
 * wrist to swallow the end of the forearm capsule. The shoe is one unit from
 * heel to toe with its origin where the sole meets the floor, so SHOE_DROP is
 * simply how far the ankle sits above the ground.
 */
const GLOVE_LENGTH = 0.3;
const GLOVE_RISE = 0.04;
/**
 * Fattened across the arm without being lengthened along it.
 *
 * A correctly-proportioned glove is about 0.6 as wide as it is long, which on
 * this rig comes out *narrower* than the forearm capsule it is supposed to
 * swallow — so the arm pokes out through its sides. Scaling up uniformly
 * instead would put the fighters' hands below their knees. Same argument as the
 * oversized head: these are caricatures, and the part has to read at the size
 * it actually occupies on screen.
 */
const GLOVE_GIRTH = 1.4;
const SHOE_LENGTH = 0.34;
const SHOE_DROP = -0.07;

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
  const hair = mat(def.colors.hair, { roughness: 0.7, metalness: 0 });
  // The face is a photo, so the base colour has to be white — anything else
  // tints the picture. Most of what you see is the emissive copy of the map
  // rather than the lit one: the arena's ambient is a strong blue, and a purely
  // lit face comes out grey and unrecognisable at the size a head occupies on
  // screen. Carrying its own light keeps the photo looking like the photo.
  const faceMap = faceTexture(def.id);
  const face = mat("#ffffff", {
    map: faceMap,
    emissive: new THREE.Color(0.55, 0.55, 0.55),
    emissiveMap: faceMap,
    roughness: 0.62,
    metalness: 0,
  });

  const attach = (
    bone: BoneName,
    geo: THREE.BufferGeometry,
    // An array is one material per box face, in three's order:
    // [+x, -x, +y, -y, +z, -z] — right, left, top, bottom, front, back.
    material: THREE.Material | THREE.Material[],
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

  // --- head ---------------------------------------------------------------
  // The real head is a photogrammetric model loaded asynchronously (see
  // heads.ts). Until it lands — and permanently, if the file is missing — the
  // fighter wears this blocky stand-in instead: the same face photo mapped onto
  // the two *side* faces of a box.
  //
  // The sides, not the front, because the arena camera always sits
  // perpendicular to the line between the fighters (see updateCamera), so a
  // fighter squared up to their opponent shows the player their profile and a
  // front-mounted face would never once be visible. Front and back stay hair,
  // which makes turning through a corner read as a head turning away rather
  // than flashing two complete faces at once.
  const blockHead = attach(
    "Head",
    box(0.44, 0.42, 0.4),
    [face, face, hair, skin, hair, hair],
    [0, 0.2, 0],
  );
  const blockHair = attach("Head", box(0.47, 0.13, 0.43), hair, [0, 0.4, 0]);

  const live: RigLive = { alive: true, headMesh: null };
  void loadHead(def.id).then((model) => {
    if (!model || !live.alive) return;

    // White base colour, and most of what you see is the emissive copy of the
    // map: the arena ambient is a strong blue and a purely lit head comes out
    // grey and unrecognisable, which defeats the entire point of having one.
    const headMat = mat("#ffffff", {
      map: model.texture,
      emissive: new THREE.Color(0.6, 0.6, 0.6),
      emissiveMap: model.texture,
      roughness: 0.8,
      metalness: 0,
    });
    // mat() has already registered headMat for the hit flash and for disposal.
    // The geometry deliberately is not registered: it is shared with every
    // other rig that ever wears this head, and disposing it here would leave
    // the next match with an empty buffer.
    const mesh = new THREE.Mesh(model.geometry, headMat);
    mesh.scale.setScalar(HEAD_HEIGHT);
    mesh.position.y = HEAD_DROP;
    mesh.castShadow = true;
    bones.Head.add(mesh);
    live.headMesh = mesh;

    blockHead.visible = false;
    blockHair.visible = false;
  });

  // --- arms --------------------------------------------------------------
  // The limbs stay capsules deliberately. A capsule's hemispherical cap *is* a
  // ball joint: two of them rotating about a shared point interpenetrate at any
  // angle, so an elbow or a knee never opens a seam. Swap either for a solid
  // scanned limb and the joint tears the moment it bends — which is why only
  // the parts below that genuinely do not bend get real models.
  const blockHands: THREE.Mesh[] = [];
  for (const s of SIDES) {
    attach(`${s}Arm` as BoneName, limb(0.1, 0.32), shirt, [0, -0.14, 0]);
    attach(`${s}ForeArm` as BoneName, limb(0.088, 0.3), skin, [0, -0.13, 0]);
    blockHands.push(
      attach(`${s}Hand` as BoneName, box(0.17, 0.18, 0.17), accent, [0, -0.06, 0]),
    );
  }

  // --- legs --------------------------------------------------------------
  const blockFeet: THREE.Mesh[] = [];
  for (const s of SIDES) {
    attach(`${s}UpLeg` as BoneName, limb(0.135, 0.46), pants, [0, -0.21, 0]);
    attach(`${s}Leg` as BoneName, limb(0.115, 0.44), pants, [0, -0.2, 0]);
    blockFeet.push(
      attach(`${s}Foot` as BoneName, box(0.19, 0.12, 0.32), dark, [0, -0.05, 0.06]),
    );
  }

  // --- gloves and shoes ---------------------------------------------------
  // Same deal as the head: real models arrive asynchronously and replace the
  // blocks above, which stay up permanently if a file is missing. One geometry
  // serves both sides, mirrored across X for the left (see gear.ts).
  const wear = (
    id: GearId,
    bone: (s: Side) => BoneName,
    fallbacks: THREE.Mesh[],
    scale: [number, number, number],
    y: number,
    material: (tex: THREE.Texture) => THREE.MeshStandardMaterial,
  ) => {
    void loadGear(id).then((model) => {
      if (!model || !live.alive) return;
      const m = material(model.texture);
      SIDES.forEach((s, i) => {
        const mesh = new THREE.Mesh(s === "Left" ? model.left : model.right, m);
        mesh.scale.set(...scale);
        mesh.position.y = y;
        mesh.castShadow = true;
        bones[bone(s)].add(mesh);
        fallbacks[i].visible = false;
      });
    });
  };

  const gloveWide = GLOVE_LENGTH * GLOVE_GIRTH;
  wear(
    "glove",
    (s) => `${s}Hand` as BoneName,
    blockHands,
    [gloveWide, GLOVE_LENGTH, gloveWide],
    GLOVE_RISE,
    (tex) =>
    // Shipped near-greyscale precisely so this multiply works, which is how one
    // asset becomes two fighters' gloves. The black cuff trim stays black under
    // a tint; only the leather takes the colour.
    mat(def.colors.accent, {
      map: tex,
      emissive: new THREE.Color(def.colors.accent).multiplyScalar(0.5),
      emissiveMap: tex,
      roughness: 0.6,
      metalness: 0.02,
    }),
  );

  wear(
    "shoe",
    (s) => `${s}Foot` as BoneName,
    blockFeet,
    [SHOE_LENGTH, SHOE_LENGTH, SHOE_LENGTH],
    SHOE_DROP,
    (tex) =>
    // White base, because the sneaker's own texture is already the look — the
    // emissive copy is what keeps it white instead of arena-blue.
    mat("#ffffff", {
      map: tex,
      emissive: new THREE.Color(0.5, 0.5, 0.5),
      emissiveMap: tex,
      roughness: 0.75,
      metalness: 0,
    }),
  );

  return { root, bones, materials, disposables, head: bones.Head, live };
}

export function disposeRig(rig: Rig) {
  rig.live.alive = false;
  rig.live.headMesh = null;
  for (const d of rig.disposables) d.dispose();
}
