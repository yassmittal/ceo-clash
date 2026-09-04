import * as THREE from "three";
import type { FighterId } from "@/game/types";

/**
 * The face textures worn on the front of each fighter's head block.
 *
 * They are cropped from freely-licensed press photographs — see
 * public/faces/CREDITS.md for the sources and the attribution that has to ship
 * with the game, and scripts/build-faces.py for how they are cut.
 *
 * There are exactly two of these and both survive every rematch, so they are
 * cached for the life of the page rather than being disposed with the rig. The
 * alternative — re-decoding and re-uploading two 512² textures on every
 * character select — is a visible hitch for no memory worth saving.
 */
const cache = new Map<FighterId, THREE.Texture>();
const loader = new THREE.TextureLoader();

export function faceTexture(id: FighterId): THREE.Texture {
  const cached = cache.get(id);
  if (cached) return cached;

  // Loading is async, but three hands back a usable Texture immediately and
  // flags it for upload once the image decodes. The rig is therefore built
  // synchronously as before and the face simply appears a frame or two later,
  // on a head that is already the right colour.
  const tex = loader.load(`${import.meta.env.BASE_URL}faces/${id}.webp`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // A face is not a tiling pattern: clamp so the mip chain cannot bleed the
  // opposite edge of the photo across the seams of the head cube.
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  cache.set(id, tex);
  return tex;
}
