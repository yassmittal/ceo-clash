import { useEffect } from "react";
import { CHARACTERS } from "@/characters";
import { useGameStore } from "@/state/gameStore";
import { audio } from "@/audio/AudioManager";

export function WinnerScreen() {
  const winner = useGameStore((s) => s.winner);
  const line = useGameStore((s) => s.winnerLine);
  const playerId = useGameStore((s) => s.playerId);
  const opponentId = useGameStore((s) => s.opponentId);
  const rematch = useGameStore((s) => s.rematch);
  const goToMenu = useGameStore((s) => s.goToMenu);

  const def = CHARACTERS[winner === "player" ? playerId : opponentId];

  // Fast retries are the whole point: R rematches, ESC bails out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyR" || e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        audio.click();
        rematch();
      } else if (e.code === "Escape") {
        goToMenu();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rematch, goToMenu]);

  return (
    <div className="screen winner">
      <h1 className="winner-name" style={{ color: def.colors.primary }}>
        {def.name} WINS
      </h1>
      <p className="winner-line">{line}</p>
      <p className="subtitle">{winner === "player" ? "you did that" : "skill issue"}</p>

      <div className="winner-buttons">
        <button
          className="btn btn--big"
          autoFocus
          onClick={() => {
            audio.click();
            rematch();
          }}
        >
          Rematch
        </button>
        <button className="btn btn--ghost" onClick={goToMenu}>
          Menu
        </button>
      </div>
      <p className="hint">press R to run it back</p>
    </div>
  );
}
