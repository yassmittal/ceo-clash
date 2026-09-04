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

      {/*
        The fighters now wear real, cropped photographs, so the old "does not
        depict real people" line would simply be false. What is left is what is
        actually true — parody, unaffiliated, unendorsed — plus the CC BY
        attribution, which has to travel with the images rather than sit in a
        file in the repo. See public/faces/CREDITS.md.
      */}
      <p className="disclaimer">
        An unaffiliated parody. Not endorsed by, or associated with, anyone depicted.
        <br />
        Faces cropped from photos by Steve Jurvetson and TechCrunch, used under{" "}
        <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">
          CC BY 2.0
        </a>
        .
      </p>
    </div>
  );
}
