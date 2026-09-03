import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { COMBAT } from "@/combat/moves";
import { ARENA_TICKER } from "@/game/brainrot";

/**
 * ONE arena, built from primitives. The plan is emphatic that this should not
 * eat days of modelling: a neon disc, an octagon of light walls, two jumbotrons
 * and a crowd of bobbing boxes is enough to sell the place.
 */

const R = COMBAT.arenaRadius;
const WALL_SEGMENTS = 8;

/**
 * All four screens share ONE canvas texture and one redraw per frame. Giving
 * each screen its own would mean four 1024x256 texture uploads every frame for
 * four copies of the same scrolling text.
 */
function useTickerTexture() {
  const state = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const message = `${ARENA_TICKER.join("   •   ")}   •   `;
    ctx.font = "bold 64px system-ui, sans-serif";
    return { canvas, ctx, texture, message, width: ctx.measureText(message).width, offset: 0 };
  }, []);

  useFrame((_, dt) => {
    const { ctx, canvas, texture, message, width } = state;
    state.offset = (state.offset + dt * 120) % width;
    ctx.fillStyle = "#07080f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 64px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#39d9ff";
    let x = -state.offset;
    while (x < canvas.width) {
      ctx.fillText(message, x, canvas.height / 2);
      x += width;
    }
    ctx.strokeStyle = "#ff3ce0";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    texture.needsUpdate = true;
  });

  return state.texture;
}

function Jumbotron({
  texture,
  position,
  rotation,
  width = 6,
  height = 2.4,
}: {
  texture: THREE.Texture;
  position: [number, number, number];
  rotation: [number, number, number];
  width?: number;
  height?: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function Crowd() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 220;
  const seeds = useMemo(() => {
    const list: Array<{ x: number; z: number; y: number; phase: number; scale: number; color: THREE.Color }> = [];
    for (let i = 0; i < count; i++) {
      const ring = R + 2.2 + Math.random() * 5;
      const angle = Math.random() * Math.PI * 2;
      list.push({
        x: Math.cos(angle) * ring,
        z: Math.sin(angle) * ring,
        y: 0.4 + Math.random() * 1.6,
        phase: Math.random() * Math.PI * 2,
        scale: 0.7 + Math.random() * 0.6,
        color: new THREE.Color().setHSL(0.55 + Math.random() * 0.25, 0.7, 0.18 + Math.random() * 0.1),
      });
    }
    return list;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      dummy.position.set(s.x, s.y + Math.sin(t * 3 + s.phase) * 0.16, s.z);
      dummy.scale.set(s.scale * 0.5, s.scale, s.scale * 0.5);
      dummy.rotation.y = Math.atan2(-s.x, -s.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, s.color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <capsuleGeometry args={[0.28, 0.8, 3, 6]} />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  );
}

export function Arena() {
  const ticker = useTickerTexture();
  const walls = useMemo(
    () =>
      Array.from({ length: WALL_SEGMENTS }, (_, i) => {
        const angle = (i / WALL_SEGMENTS) * Math.PI * 2;
        const inset = R + 0.4;
        return {
          position: [Math.cos(angle) * inset, 1.4, Math.sin(angle) * inset] as [number, number, number],
          rotation: [0, -angle, 0] as [number, number, number],
          width: (2 * Math.PI * inset) / WALL_SEGMENTS / 2 + 0.35,
        };
      }),
    [],
  );

  return (
    <group>
      {/* --- lighting: dramatic, cheap ---------------------------------- */}
      <ambientLight intensity={1.1} color="#9db4ff" />
      <hemisphereLight args={["#7f96ff", "#241436", 1.1]} />
      <directionalLight
        position={[6, 12, 6]}
        intensity={2.6}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <spotLight position={[-9, 10, -6]} angle={0.8} penumbra={0.6} intensity={260} color="#ff3ce0" />
      <spotLight position={[9, 10, 6]} angle={0.8} penumbra={0.6} intensity={260} color="#39d9ff" />
      {/* key light straight down on the circle, so the action is always lit */}
      <pointLight position={[0, 7, 0]} intensity={90} distance={22} color="#ffffff" />

      {/* --- floor ------------------------------------------------------ */}
      <RigidBody type="fixed" colliders={false} friction={0.4}>
        <CuboidCollider args={[30, 0.5, 30]} position={[0, -0.5, 0]} />
      </RigidBody>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0.001, 0]}>
        <circleGeometry args={[R + 0.6, 64]} />
        <meshStandardMaterial color="#12142a" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[R - 0.15, R + 0.35, 64]} />
        <meshBasicMaterial color="#39d9ff" toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <ringGeometry args={[2.4, 2.55, 48]} />
        <meshBasicMaterial color="#ff3ce0" toneMapped={false} opacity={0.7} transparent />
      </mesh>
      <gridHelper args={[R * 2, 24, "#2b3a8c", "#1b2050"]} position={[0, 0.005, 0]} />

      {/* the ground beyond the ring, so the arena reads as a floating disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[40, 48]} />
        <meshStandardMaterial color="#080a16" roughness={1} />
      </mesh>

      {/* --- octagon light walls (real Rapier colliders) ----------------- */}
      {walls.map((w, i) => (
        <RigidBody key={i} type="fixed" colliders={false} position={w.position} rotation={w.rotation}>
          <CuboidCollider args={[0.3, 1.6, w.width]} />
          <mesh castShadow={false}>
            <boxGeometry args={[0.16, 2.6, w.width * 2]} />
            <meshStandardMaterial
              color="#1b2050"
              emissive="#3450ff"
              emissiveIntensity={0.7}
              transparent
              opacity={0.35}
            />
          </mesh>
          <mesh position={[0, 1.35, 0]}>
            <boxGeometry args={[0.26, 0.1, w.width * 2]} />
            <meshBasicMaterial color="#7ee0ff" toneMapped={false} />
          </mesh>
        </RigidBody>
      ))}

      {/* --- jumbotrons -------------------------------------------------- */}
      <Jumbotron texture={ticker} position={[0, 6.4, -17]} rotation={[0, 0, 0]} width={13} height={3} />
      <Jumbotron texture={ticker} position={[0, 6.4, 17]} rotation={[0, Math.PI, 0]} width={13} height={3} />
      <Jumbotron texture={ticker} position={[-17, 6, 0]} rotation={[0, Math.PI / 2, 0]} width={10} height={2.6} />
      <Jumbotron texture={ticker} position={[17, 6, 0]} rotation={[0, -Math.PI / 2, 0]} width={10} height={2.6} />

      {/* --- giant ridiculous logos -------------------------------------- */}
      <mesh position={[-10, 8.5, -12]} rotation={[0, 0.5, 0.2]}>
        <torusGeometry args={[1.5, 0.35, 8, 24]} />
        <meshStandardMaterial color="#1f8cff" emissive="#1f8cff" emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[10, 8.8, -12]} rotation={[0.3, -0.4, 0]}>
        <icosahedronGeometry args={[1.4, 0]} />
        <meshStandardMaterial color="#ff7a45" emissive="#ff7a45" emissiveIntensity={0.7} flatShading />
      </mesh>

      <Crowd />
    </group>
  );
}
