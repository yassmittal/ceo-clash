import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Arena } from "./Arena";
import { GameLoop } from "./GameLoop";
import { Fighter } from "@/characters/Fighter";
import { ParticleField } from "@/effects/ParticleField";
import { initFight } from "./runtime";
import { resetCamera } from "./Camera";
import { CHARACTERS } from "@/characters";
import { useGameStore } from "@/state/gameStore";
import { input } from "@/input/InputManager";
import { preloadGear } from "@/characters/rig/gear";
import { preloadHeads } from "@/characters/rig/heads";

/**
 * The 3D half of the app. It stays mounted for the whole session — the menu is
 * drawn over a live arena, so pressing PLAY never waits on a scene build.
 */
export function Game() {
  const playerId = useGameStore((s) => s.playerId);
  const opponentId = useGameStore((s) => s.opponentId);
  const matchKey = useGameStore((s) => s.matchKey);

  // A new match means fresh runtime objects; the Fighters remount alongside them.
  const runtime = useMemo(
    () => initFight(CHARACTERS[playerId], CHARACTERS[opponentId]),
    [playerId, opponentId, matchKey],
  );

  useEffect(() => resetCamera(), [matchKey]);

  // The gloves and shoes are shared by everyone, so they are worth warming as
  // soon as the arena mounts behind the menu.
  useEffect(() => {
    preloadGear();
  }, []);

  // Heads are per fighter, so only the chosen pair is fetched, and only once
  // select has locked them in. The store holds the match in LOADING until both
  // have landed (or failed, which falls back to the blocky head), so nothing
  // pops in during the countdown.
  const phase = useGameStore((s) => s.phase);
  useEffect(() => {
    if (phase !== "LOADING") return;
    let cancelled = false;
    void preloadHeads([playerId, opponentId]).then(() => {
      const store = useGameStore.getState();
      if (cancelled || store.phase !== "LOADING" || store.matchKey !== matchKey) return;
      store.setCountdown(3);
      store.setPhase("COUNTDOWN");
    });
    return () => {
      cancelled = true;
    };
  }, [phase, playerId, opponentId, matchKey]);

  // Dev-only bridge: lets you poke at the live fight from the browser console
  // (window.ceoClash.fight.opponent.health = 5) and is stripped from builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { ceoClash: unknown }).ceoClash = {
      fight: runtime,
      store: useGameStore,
      input,
    };
  }, [runtime]);

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 48, position: [0, 3, 9], near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#04050e"]} />
      <fog attach="fog" args={["#04050e", 20, 52]} />

      <Physics gravity={[0, -30, 0]} timeStep="vary">
        <Arena />
        <Fighter key={`p-${matchKey}`} runtime={runtime.player} />
        <Fighter key={`o-${matchKey}`} runtime={runtime.opponent} />
      </Physics>

      <ParticleField />
      <GameLoop />
    </Canvas>
  );
}
