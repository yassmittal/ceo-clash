import { useGameStore } from "@/state/gameStore";
import { audio } from "@/audio/AudioManager";

export function MainMenu() {
  const goToSelect = useGameStore((s) => s.goToSelect);

  const play = () => {
    // Browsers only allow audio to start from a real gesture — this is it.
    audio.unlock();
    audio.click();
    goToSelect();
  };

  return (
    <div className="screen">
      <h1 className="title">
        CEO
        <br />
        CLASH
      </h1>

      <div className="versus">
        <span className="name-sam">SAM</span>
        <span className="vs">VS</span>
        <span className="name-dario">DARIO</span>
      </div>

      <button className="btn btn--big" onClick={play} autoFocus>
        Play
      </button>

      <p className="subtitle">
        two ceos · one arena · zero benchmarks
      </p>

      <p className="disclaimer">
        A fictional parody game. Not affiliated with, endorsed by, or depicting real people or companies.
      </p>
    </div>
  );
}
