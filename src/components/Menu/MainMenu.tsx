import type React from "react";
import { Fragment, useEffect, useState } from "react";
import { CHARACTERS, CHARACTER_LIST, photoCredits, randomPair } from "@/characters";
import { useGameStore } from "@/state/gameStore";
import { audio } from "@/audio/AudioManager";
import { AUTHOR } from "@/author";
import { SourceLink } from "@/components/UI/SourceLink";

/** How long each matchup sits on the menu before the next one slams in. */
const VERSUS_ROTATE_MS = 2400;

/** A random matchup that changes every couple of seconds — never the same twice running. */
function useRotatingPair() {
  const [pair, setPair] = useState(randomPair);
  useEffect(() => {
    if (CHARACTER_LIST.length <= 2) return;
    const handle = window.setInterval(() => {
      setPair((prev) => {
        let next = randomPair();
        for (let i = 0; i < 6 && next[0] === prev[0] && next[1] === prev[1]; i++) next = randomPair();
        return next;
      });
    }, VERSUS_ROTATE_MS);
    return () => window.clearInterval(handle);
  }, []);
  return pair;
}

export function MainMenu() {
  const goToSelect = useGameStore((s) => s.goToSelect);
  const [left, right] = useRotatingPair().map((id) => CHARACTERS[id]);
  const credits = photoCredits();

  const play = () => {
    // Browsers only allow audio to start from a real gesture — this is it.
    audio.unlock();
    audio.click();
    goToSelect();
  };

  return (
    <div className="screen main-menu">
      <h1 className="title">
        CEO
        <br />
        CLASH
      </h1>

      <div className="versus" key={`${left.id}-${right.id}`}>
        <span className="versus-name" style={{ "--fighter": left.colors.primary } as React.CSSProperties}>
          {left.name}
        </span>
        <span className="vs">VS</span>
        <span className="versus-name" style={{ "--fighter": right.colors.primary } as React.CSSProperties}>
          {right.name}
        </span>
      </div>

      <button className="btn btn--big" onClick={play} autoFocus>
        Play
      </button>

      <p className="subtitle">
        {CHARACTER_LIST.length} ceos · one arena · zero benchmarks
      </p>

      {/* Signed, the way the title block on a drawing is signed: quiet, and
          pointing at the whole thing rather than at a portfolio. */}
      <p className="byline">
        built by {AUTHOR.name} · open source ·{" "}
        <SourceLink label="read the code" className="byline-link" markSize={11} />
      </p>

      {/*
        The fighters wear real likenesses — photographs on the UI portraits, and
        3D heads reconstructed from those same photographs — so the old "does
        not depict real people" line would simply be false. What is left is what
        is actually true — parody, unaffiliated, unendorsed — plus the
        attribution, which has to travel with the game rather than sit in a file
        in the repo. It is built from each fighter's `photo` field, grouped by
        licence, so a new fighter cannot ship uncredited. See
        public/faces/CREDITS.md and public/models/CREDITS.md.
      */}
      <p className="disclaimer">
        An unaffiliated parody. Not endorsed by, or associated with, anyone depicted.
        <br />
        Likenesses built from photos by{" "}
        {credits.map((g, i) => (
          <Fragment key={g.license}>
            {i > 0 && "; "}
            {listAuthors(g.authors)} (
            {g.licenseUrl ? (
              <a href={g.licenseUrl} target="_blank" rel="noreferrer">
                {g.license}
              </a>
            ) : (
              g.license.toLowerCase()
            )}
            )
          </Fragment>
        ))}
        .
      </p>
    </div>
  );
}

const listAuthors = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
