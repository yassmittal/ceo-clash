import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * The fighters' gloves and shoes.
 *
 * Built by `scripts/build-gear.py` from Tripo text-to-3D — so unlike the heads
 * these are not derived from anyone's photograph and carry no attribution
 * obligation. Each arrives already oriented for the rig: the glove hangs cuff-up
 * with its knuckles down +Z, the shoe points its toe down +Z with its origin
 * where the sole meets the floor.
 *
 * Only rigid parts get this treatment. A glove barely moves against the wrist
 * and a shoe barely moves against the ankle, so a solid mesh bolted to one bone
 * is honest. Forearms and shins are not rigid — they meet at a joint that bends,
 * and two solid meshes meeting at a bent elbow tear open, which is exactly what
 * the capsules' round caps quietly prevent.
 */
export interface GearModel {
  /** As authored. Worn on the right hand / right foot. */
  right: THREE.BufferGeometry;
  /** Mirrored across X, for the other side. */
  left: THREE.BufferGeometry;
  texture: THREE.Texture;
}

export type GearId = "glove" | "shoe";

const loader = new GLTFLoader();
const cache = new Map<GearId, Promise<GearModel | null>>();

/**
 * Mirrors a geometry across X.
 *
 * Reflecting the positions is only half of it: a reflection reverses the
 * handedness of every triangle, so the winding has to be flipped back or the
 * whole mesh ends up inside-out and is culled away. The normals are reflected
 * to match rather than recomputed, which keeps the generator's smoothing.
 *
 * Doing this here rather than shipping a second GLB halves what the browser has
 * to download for a part that is, by definition, the same object.
 */
function mirrorX(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = geo.clone();

  for (const name of ["position", "normal"] as const) {
    const attr = out.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!attr) continue;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) arr[i] = -arr[i];
    attr.needsUpdate = true;
  }

  const index = out.getIndex();
  if (index) {
    const a = index.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    index.needsUpdate = true;
  }

  out.computeBoundingSphere();
  return out;
}

/**
 * Resolves to null rather than rejecting when a model is missing or broken, so
 * a failed fetch costs the fighter their gloves and not their hands — the rig
 * keeps its blocky fallbacks up in that case.
 */
export function loadGear(id: GearId): Promise<GearModel | null> {
  const hit = cache.get(id);
  if (hit) return hit;

  const pending = loader
    .loadAsync(`${import.meta.env.BASE_URL}models/${id}.glb`)
    .then((gltf) => {
      let found: THREE.Mesh | null = null;
      gltf.scene.traverse((o) => {
        if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
      });
      if (!found) throw new Error(`no mesh in ${id} GLB`);

      const mesh = found as THREE.Mesh;
      const texture = (mesh.material as THREE.MeshStandardMaterial).map;
      if (!texture) throw new Error(`${id} GLB has no base colour texture`);
      texture.anisotropy = 8;

      // The GLB's own material is dropped; the rig builds its own so gear
      // answers to the same hit-flash channel as the rest of the body. Both
      // geometries are shared by every rig that ever wears them.
      return { right: mesh.geometry, left: mirrorX(mesh.geometry), texture };
    })
    .catch((err: unknown) => {
      console.warn(`[ceo-clash] falling back to the blocky ${id}:`, err);
      return null;
    });

  cache.set(id, pending);
  return pending;
}

/**
 * Warms both, for the same reason preloadHeads exists: the arena is mounted for
 * the whole session behind the menu, so these are decoded and uploaded long
 * before anyone reaches a fight and nothing pops in mid-round.
 */
export function preloadGear(): void {
  void loadGear("glove");
  void loadGear("shoe");
}
