import type React from "react";
import { CHARACTERS } from "@/characters";
import { useGameStore } from "@/state/gameStore";
import { Portrait } from "./Portrait";

/**
 * The LOADING phase: the matchup card shown while the chosen pair's heads are
 * fetched. It is usually on screen for a beat at most — the heads are small and
 * cached after the first fight — but on a slow connection it is what stands
 * between the player and a fighter whose head pops in mid-countdown.
 */
export function Loading() {
  const player = CHARACTERS[useGameStore((s) => s.playerId)];
  const opponent = CHARACTERS[useGameStore((s) => s.opponentId)];

  return (
    <div className="screen loading">
      <div className="loading-pair">
        <div className="loading-side">
          <Portrait def={player} size="hero" />
          <span className="versus-name" style={{ "--fighter": player.colors.primary } as React.CSSProperties}>
            {player.name}
          </span>
        </div>
        <span className="vs">VS</span>
        <div className="loading-side">
          <Portrait def={opponent} size="hero" />
          <span className="versus-name" style={{ "--fighter": opponent.colors.primary } as React.CSSProperties}>
            {opponent.name}
          </span>
        </div>
      </div>
      <p className="subtitle loading-label">loading the fighters</p>
    </div>
  );
}
