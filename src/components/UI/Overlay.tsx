import { useEffect } from "react";
import { useGameStore } from "@/state/gameStore";
import { MainMenu } from "@/components/Menu/MainMenu";
import { CharacterSelect } from "@/components/CharacterSelect/CharacterSelect";
import { Hud } from "@/components/HUD/Hud";
import { Countdown } from "./Countdown";
import { WinnerScreen } from "./WinnerScreen";
import { ControlsStrip } from "./ControlsStrip";
import { audio } from "@/audio/AudioManager";

/** Routes the DOM UI off the single global phase. */
export function Overlay() {
  const phase = useGameStore((s) => s.phase);
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const goToMenu = useGameStore((s) => s.goToMenu);

  useEffect(() => audio.setMuted(muted), [muted]);

  const inMatch = phase === "COUNTDOWN" || phase === "FIGHTING" || phase === "KO";

  return (
    <div className="ui-layer">
      {inMatch && <Hud />}
      {inMatch && <ControlsStrip />}
      {phase === "COUNTDOWN" && <Countdown />}
      {phase === "MENU" && <MainMenu />}
      {phase === "CHARACTER_SELECT" && <CharacterSelect />}
      {phase === "WINNER" && <WinnerScreen />}

      <div className="corner-buttons">
        {inMatch && (
          <button className="icon-btn" onClick={goToMenu}>
            QUIT
          </button>
        )}
        <button className="icon-btn" onClick={toggleMute}>
          {muted ? "SOUND OFF" : "SOUND ON"}
        </button>
      </div>

      <div className="crt" />
    </div>
  );
}
