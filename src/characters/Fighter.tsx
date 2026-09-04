import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { buildRig, disposeRig, type Rig } from "./rig/buildRig";
import { buildGltfRig, modelPath } from "./rig/gltfRig";
import { buildClips } from "./animations/clips";
import { Animator } from "./animations/Animator";
import type { FighterRuntime } from "@/game/runtime";
import { COMBAT } from "@/combat/moves";

/**
 * One fighter: a Rapier capsule that owns the position, plus a bone rig parented
 * inside it that owns the pose.
 *
 * The component is deliberately dumb — it builds the rig, registers it on the
 * runtime object and gets out of the way. Everything that happens per frame is
 * driven by the single director loop in GameLoop.tsx, which keeps simulation
 * order deterministic.
 */
/**
 * Builds the fighter's visual rig — a generated GLB when one has been produced,
 * otherwise the procedural placeholder. Both return the same shape, and the
 * animation clips are the same twelve either way: for the GLB they are
 * retargeted onto its Mixamo-spec skeleton at load time.
 */
function useFighterRig(runtime: FighterRuntime, gltf: ReturnType<typeof useGLTF> | null) {
  return useMemo(() => {
    const clips = buildClips(runtime.def);
    if (gltf) {
      const rig = buildGltfRig(gltf as never, clips, runtime.def);
      return { rig: rig as unknown as Rig, clips: rig.clips };
    }
    return { rig: buildRig(runtime.def), clips };
  }, [runtime.def, gltf]);
}

function FighterRig({ runtime, gltf }: { runtime: FighterRuntime; gltf: ReturnType<typeof useGLTF> | null }) {
  const { rig, clips } = useFighterRig(runtime, gltf);
  const animator = useMemo(() => new Animator(rig.root, clips), [rig, clips]);

  useEffect(() => {
    runtime.animator = animator;
    runtime.rigMaterials = rig.materials;
    return () => {
      animator.dispose();
      disposeRig(rig);
      runtime.animator = null;
      runtime.rigMaterials = null;
    };
  }, [animator, rig, runtime]);

  return <primitive object={rig.root} />;
}

/** Loads the GLB for this character, suspending until it is ready. */
function GltfRigLoader({ runtime }: { runtime: FighterRuntime }) {
  const gltf = useGLTF(modelPath(runtime.def.id));
  return <FighterRig runtime={runtime} gltf={gltf} />;
}

export function Fighter({ runtime, useModel = true }: { runtime: FighterRuntime; useModel?: boolean }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);

  useEffect(() => {
    runtime.body = bodyRef.current;
    runtime.visual = visualRef.current;
    // The runtime already holds this match's spawn point; snap the body to it.
    bodyRef.current?.setTranslation(
      { x: runtime.position.x, y: runtime.position.y, z: runtime.position.z },
      true,
    );
    bodyRef.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
    if (visualRef.current) visualRef.current.rotation.y = runtime.facing;
    return () => {
      runtime.body = null;
      runtime.visual = null;
    };
  }, [runtime]);

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={[runtime.position.x, runtime.position.y, runtime.position.z]}
      enabledRotations={[false, false, false]}
      linearDamping={0.05}
      friction={0}
      restitution={0}
      ccd
      canSleep={false}
    >
      <CapsuleCollider args={[0.5, COMBAT.bodyRadius]} />
      {/* Feet sit 0.9m below the capsule centre. */}
      <group ref={visualRef} position={[0, -0.9, 0]}>
        {useModel ? (
          // While the GLB streams in, the placeholder stands in — the fight is
          // already running behind the menu, so it must never be empty.
          <Suspense fallback={<FighterRig runtime={runtime} gltf={null} />}>
            <GltfRigLoader runtime={runtime} />
          </Suspense>
        ) : (
          <FighterRig runtime={runtime} gltf={null} />
        )}
        {/* Contact shadow stand-in — cheap and keeps the fighter grounded. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.42, 20]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>
    </RigidBody>
  );
}

useGLTF.preload("/models/sam.glb");
useGLTF.preload("/models/dario.glb");
