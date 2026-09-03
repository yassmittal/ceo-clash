import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { drainBursts } from "./effectsBus";
import { fight } from "@/game/runtime";

/**
 * One pooled particle system for every impact in the game.
 *
 * Nothing is allocated at runtime: a fixed pool of points is recycled, oldest
 * first. Particles run on the *scaled* clock so they hang in the air during
 * hitstop and slow motion, which is most of why a special feels heavy.
 */

const MAX = 420;

function sprite() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.65)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const state = useMemo(() => {
    const positions = new Float32Array(MAX * 3);
    const colors = new Float32Array(MAX * 3);
    const sizes = new Float32Array(MAX);
    const velocities = new Float32Array(MAX * 3);
    const life = new Float32Array(MAX);
    const maxLife = new Float32Array(MAX);
    return { positions, colors, sizes, velocities, life, maxLife, cursor: 0 };
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(state.positions, 3));
    g.setAttribute("pcolor", new THREE.BufferAttribute(state.colors, 3));
    g.setAttribute("size", new THREE.BufferAttribute(state.sizes, 1));
    return g;
  }, [state]);

  const texture = useMemo(sprite, []);

  // A tiny shader so each particle can carry its own size and fade independently.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { map: { value: texture } },
        vertexShader: /* glsl */ `
          attribute float size;
          attribute vec3 pcolor;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vColor = pcolor;
            vAlpha = clamp(size, 0.0, 1.0);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = max(1.0, size * 26.0 / max(0.001, -mv.z));
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D map;
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec4 tex = texture2D(map, gl_PointCoord);
            gl_FragColor = vec4(vColor, 1.0) * tex * vAlpha;
            if (gl_FragColor.a < 0.01) discard;
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [texture],
  );

  // A single expanding shockwave ring, reused by whichever hit is most recent.
  const ring = useRef({ life: 0, power: 1, color: new THREE.Color("#ffffff") });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30) * fight.timeScale;

    for (const burst of drainBursts()) {
      const count = burst.kind === "special" ? 90 : burst.kind === "heavy" ? 46 : 24;
      const speed = burst.kind === "special" ? 9 : burst.kind === "heavy" ? 6.5 : 4.4;
      for (let i = 0; i < count; i++) {
        const idx = state.cursor;
        state.cursor = (state.cursor + 1) % MAX;
        const i3 = idx * 3;
        state.positions[i3] = burst.position.x;
        state.positions[i3 + 1] = burst.position.y;
        state.positions[i3 + 2] = burst.position.z;
        // Random direction, biased upward so sparks arc.
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const v = speed * (0.35 + Math.random() * 0.9);
        state.velocities[i3] = Math.sin(phi) * Math.cos(theta) * v;
        state.velocities[i3 + 1] = Math.abs(Math.cos(phi)) * v * 0.85 + 1.4;
        state.velocities[i3 + 2] = Math.sin(phi) * Math.sin(theta) * v;
        state.colors[i3] = burst.color.r;
        state.colors[i3 + 1] = burst.color.g;
        state.colors[i3 + 2] = burst.color.b;
        state.sizes[idx] = 0.4 + Math.random() * 0.9 * burst.power;
        state.maxLife[idx] = 0.35 + Math.random() * 0.45;
        state.life[idx] = state.maxLife[idx];
      }
      ring.current.life = 0.34;
      ring.current.power = burst.power;
      ring.current.color.copy(burst.color);
      if (ringRef.current) ringRef.current.position.copy(burst.position);
    }

    // Integrate.
    for (let i = 0; i < MAX; i++) {
      if (state.life[i] <= 0) {
        state.sizes[i] = 0;
        continue;
      }
      const i3 = i * 3;
      state.life[i] -= dt;
      state.velocities[i3 + 1] -= 22 * dt;
      state.positions[i3] += state.velocities[i3] * dt;
      state.positions[i3 + 1] += state.velocities[i3 + 1] * dt;
      state.positions[i3 + 2] += state.velocities[i3 + 2] * dt;
      if (state.positions[i3 + 1] < 0.05) {
        state.positions[i3 + 1] = 0.05;
        state.velocities[i3 + 1] *= -0.35;
      }
      const t = Math.max(0, state.life[i] / state.maxLife[i]);
      state.sizes[i] = t * (0.5 + t);
    }

    const geo = pointsRef.current?.geometry;
    if (geo) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.pcolor.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
    }

    // Shockwave.
    const r = ringRef.current;
    if (r) {
      if (ring.current.life > 0) {
        ring.current.life -= dt;
        const t = 1 - Math.max(0, ring.current.life) / 0.34;
        const scale = 0.3 + t * 2.4 * ring.current.power;
        r.visible = true;
        r.scale.setScalar(scale);
        const mat = r.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - t) * 0.85;
        mat.color.copy(ring.current.color);
        r.lookAt(0, r.position.y + 1, 0);
        r.rotation.x = -Math.PI / 2;
      } else {
        r.visible = false;
      }
    }
  });

  return (
    <group>
      <points ref={pointsRef} frustumCulled={false}>
        <primitive object={geometry} attach="geometry" />
        <primitive object={material} attach="material" />
      </points>
      <mesh ref={ringRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
