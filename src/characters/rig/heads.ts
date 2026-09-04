import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { FighterId } from "@/game/types";

/**
 * The fighters' 3D heads.
 *
 * Each is a ~4.5k-triangle photogrammetric head built by
 * `scripts/build-heads.py` from the same CC BY press photo the face texture
 * comes from (see public/models/CREDITS.md). The asset arrives already facing
 * +Z, normalised to one unit tall, with its origin at the base of the neck —
 * all the rig has to decide is how big a head should be.
 *
 * Only the geometry and the texture are taken from the GLB. The material is
 * built by the rig instead, so the head answers to the same hit-flash channel
 * as every other body part rather than to whatever Tripo happened to export.
 */
export interface HeadModel {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
}

const loader = new GLTFLoader();
const cache = new Map<FighterId, Promise<HeadModel | null>>();

/**
 * Resolves to null rather than rejecting when the model is missing or broken.
 * A fighter with no head would be a worse bug than a fighter wearing the blocky
 * fallback head, so the caller is handed a "no" it can act on.
 */
export function loadHead(id: FighterId): Promise<HeadModel | null> {
  const hit = cache.get(id);
  if (hit) return hit;

  const pending = loader
    .loadAsync(`${import.meta.env.BASE_URL}models/${id}-head.glb`)
    .then((gltf) => {
      let mesh: THREE.Mesh | null = null;
      gltf.scene.traverse((o) => {
        if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
      });
      if (!mesh) throw new Error("no mesh in head GLB");

      const found = mesh as THREE.Mesh;
      const texture = (found.material as THREE.MeshStandardMaterial).map;
      if (!texture) throw new Error("head GLB has no base colour texture");
      texture.anisotropy = 8;

      // The GLB's own material is dropped on the floor here; the geometry and
      // texture outlive it and are shared by every rig that asks for this head.
      return { geometry: found.geometry, texture };
    })
    .catch((err: unknown) => {
      console.warn(`[ceo-clash] falling back to the blocky head for ${id}:`, err);
      return null;
    });

  cache.set(id, pending);
  return pending;
}

/**
 * Warms both heads. The arena is mounted for the whole session and the menu is
 * drawn over it, so calling this at startup means the models are decoded and
 * uploaded long before anyone reaches a fight and nothing ever pops in.
 */
export function preloadHeads(): void {
  void loadHead("sam");
  void loadHead("dario");
}
