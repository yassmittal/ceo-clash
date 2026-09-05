import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { buildRig, disposeRig } from "./rig/buildRig";
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
export function Fighter({ runtime }: { runtime: FighterRuntime }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);

  const rig = useMemo(() => buildRig(runtime.def), [runtime.def]);
  const animator = useMemo(
    () => new Animator(rig.root, buildClips(runtime.def)),
    [rig, runtime.def],
  );

  useEffect(() => {
    runtime.animator = animator;
    runtime.rigMaterials = rig.materials;
    runtime.rigLive = rig.live;
    return () => {
      animator.dispose();
      disposeRig(rig);
      runtime.animator = null;
      runtime.rigMaterials = null;
      runtime.rigLive = null;
    };
  }, [animator, rig, runtime]);

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
        <primitive object={rig.root} />
        {/* Contact shadow stand-in — cheap and keeps the fighter grounded. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.42, 20]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>
    </RigidBody>
  );
}
