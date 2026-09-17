import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CHARACTERS, CHARACTER_LIST, randomOpponent } from "@/characters";
import type { CharacterDef, FighterId } from "@/game/types";
import { useGameStore } from "@/state/gameStore";
import { audio } from "@/audio/AudioManager";
import { Portrait } from "@/components/UI/Portrait";

const STAT_KEYS = ["speed", "attack", "defense", "aggression"] as const;

/** A slot in the grid: a fighter, or the "random opponent" tile. */
type Slot = FighterId | "random";

/** Sets the one custom property every per-fighter colour in styles.css reads. */
export const fighterVars = (def: CharacterDef) =>
  ({ "--fighter": def.colors.primary }) as CSSProperties;

/**
 * Two-step select: pick your fighter, then pick an opponent (or take a random
 * one). It scales by being a grid of small portrait tiles with one detail panel
 * for whichever tile is highlighted, rather than a row of full cards.
 *
 * Input, all of it landing in the same two actions — highlight and confirm:
 *   mouse     hover highlights, click confirms
 *   touch     first tap highlights (so the panel can be read), second confirms
 *   keyboard  arrows move, Enter/Space confirms, Escape goes back a step
 */
export function CharacterSelect() {
  const selectCharacter = useGameStore((s) => s.selectCharacter);
  const goToMenu = useGameStore((s) => s.goToMenu);
  const initialStep = useGameStore((s) => s.selectStep);
  const currentPlayer = useGameStore((s) => s.playerId);

  // Opened from the winner screen's "New opponent", the fighter is already known.
  const [player, setPlayer] = useState<FighterId | null>(
    initialStep === "opponent" ? currentPlayer : null,
  );
  const step = player ? "opponent" : "fighter";

  const slots: Slot[] =
    step === "fighter"
      ? CHARACTER_LIST.map((d) => d.id)
      : ["random", ...CHARACTER_LIST.map((d) => d.id).filter((id) => id !== player)];

  const [highlight, setHighlight] = useState<Slot>(slots[0]);
  // Re-seat the highlight whenever the step changes the set of slots.
  useEffect(() => {
    setHighlight(step === "fighter" ? (player ?? CHARACTER_LIST[0].id) : "random");
  }, [step]);

  const start = useCallback(
    (me: FighterId, foe: FighterId) => {
      audio.unlock();
      audio.click();
      selectCharacter(me, foe);
    },
    [selectCharacter],
  );

  const confirm = useCallback(
    (slot: Slot) => {
      audio.unlock();
      if (step === "fighter") {
        if (slot === "random") return;
        audio.click();
        setPlayer(slot);
        return;
      }
      if (!player) return;
      start(player, slot === "random" ? randomOpponent(player) : slot);
    },
    [player, start, step],
  );

  const back = useCallback(() => {
    audio.click();
    if (step === "opponent") {
      setHighlight(player ?? CHARACTER_LIST[0].id);
      setPlayer(null);
    } else goToMenu();
  }, [goToMenu, player, step]);

  // Touch has no hover, so a tap on a tile that is not yet highlighted only
  // highlights it; mouse and pen confirm on the first click.
  const lastPointer = useRef<string>("mouse");

  // --- keyboard -------------------------------------------------------------
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      lastPointer.current = "keyboard";
      const index = Math.max(0, slots.indexOf(highlight));
      // Columns are whatever the CSS grid actually laid out at this width.
      const cols = gridRef.current
        ? getComputedStyle(gridRef.current).gridTemplateColumns.split(" ").length
        : slots.length;
      let next = index;
      switch (e.key) {
        case "ArrowRight":
          next = (index + 1) % slots.length;
          break;
        case "ArrowLeft":
          next = (index - 1 + slots.length) % slots.length;
          break;
        case "ArrowDown":
          next = index + cols < slots.length ? index + cols : index;
          break;
        case "ArrowUp":
          next = index - cols >= 0 ? index - cols : index;
          break;
        case "Enter":
        case " ":
          // A focused button handles its own Enter; don't double-fire.
          if (e.target instanceof Element && e.target.closest("button")) return;
          e.preventDefault();
          confirm(highlight);
          return;
        case "Escape":
          e.preventDefault();
          back();
          return;
        default:
          return;
      }
      e.preventDefault();
      if (next !== index) {
        setHighlight(slots[next]);
        const el = gridRef.current?.querySelector<HTMLElement>(`[data-slot="${slots[next]}"]`);
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, confirm, highlight, slots]);

  const shown = highlight === "random" ? null : CHARACTERS[highlight];
  const playerDef = player ? CHARACTERS[player] : null;

  return (
    <div className="screen select-screen">
      <header className="select-head">
        <h2 className="title select-title">
          {step === "fighter" ? "Choose your CEO" : "Choose your opponent"}
        </h2>
        <p className="subtitle">
          {step === "fighter" ? (
            "step 1 of 2 · you"
          ) : (
            <>
              step 2 of 2 ·{" "}
              <span style={{ color: playerDef?.colors.primary }}>{playerDef?.name}</span> vs ?
            </>
          )}
        </p>
      </header>

      <div className="select-body">
        <div className="roster" ref={gridRef} role="listbox" aria-label="Fighters">
          {slots.map((slot) => {
            const def = slot === "random" ? null : CHARACTERS[slot];
            const active = slot === highlight;
            return (
              <button
                key={slot}
                type="button"
                role="option"
                aria-selected={active}
                data-slot={slot}
                className={`tile ${active ? "tile--active" : ""} ${def ? "" : "tile--random"}`}
                style={def ? fighterVars(def) : undefined}
                tabIndex={active ? 0 : -1}
                onPointerDown={(e) => {
                  lastPointer.current = e.pointerType;
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType === "mouse") setHighlight(slot);
                }}
                onFocus={() => {
                  // A touch focuses the tile before its click lands; letting that
                  // highlight it would turn the "first tap highlights" into a confirm.
                  if (lastPointer.current !== "touch") setHighlight(slot);
                }}
                onClick={(e) => {
                  // detail 0 is a keyboard-generated click: always a confirm.
                  if (e.detail !== 0 && lastPointer.current === "touch" && !active) {
                    setHighlight(slot);
                    return;
                  }
                  confirm(slot);
                }}
              >
                {def ? (
                  <Portrait def={def} size="tile" />
                ) : (
                  <span className="tile-random-mark" aria-hidden>
                    ?
                  </span>
                )}
                <span className="tile-name">{def ? def.name : "RANDOM"}</span>
              </button>
            );
          })}
        </div>

        <Detail
          def={shown}
          step={step}
          onConfirm={() => confirm(highlight)}
          onQuickRandom={shown && step === "fighter" ? () => start(shown.id, randomOpponent(shown.id)) : undefined}
        />
      </div>

      <div className="select-foot">
        <button className="btn btn--ghost" onClick={back}>
          Back
        </button>
        <p className="hint select-hint">arrows · enter · esc</p>
      </div>
    </div>
  );
}

function Detail({
  def,
  step,
  onConfirm,
  onQuickRandom,
}: {
  def: CharacterDef | null;
  step: "fighter" | "opponent";
  onConfirm: () => void;
  onQuickRandom?: () => void;
}) {
  if (!def) {
    return (
      <section className="detail detail--random" aria-live="polite">
        <div className="detail-random-mark" aria-hidden>
          ?
        </div>
        <div>
          <div className="role">wildcard</div>
          <h3 className="detail-name">RANDOM</h3>
        </div>
        <p className="tagline">Let the machine pick who you fight. Nobody reads the eval anyway.</p>
        <div className="detail-actions">
          <button className="btn" onClick={onConfirm}>
            Fight
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="detail" style={fighterVars(def)} aria-live="polite">
      <div className="detail-top">
        <Portrait def={def} size="card" />
        <div className="detail-id">
          <div className="role">{def.title}</div>
          <h3 className="detail-name">{def.name}</h3>
          <p className="tagline">{def.tagline}</p>
        </div>
      </div>

      <div className="detail-stats">
        {STAT_KEYS.map((key) => (
          <div className="stat" key={key}>
            <span>{key}</span>
            <div className="stat-track">
              <div className="stat-fill" style={{ width: `${def.stats[key]}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="detail-special">
        <div className="role">special · {def.special.kind}</div>
        <div className="special-name">{def.special.name}</div>
        <div className="tagline">{def.special.description}</div>
      </div>

      <div className="detail-actions">
        <button className="btn" onClick={onConfirm}>
          {step === "fighter" ? "Pick opponent" : "Fight"}
        </button>
        {onQuickRandom && (
          <button className="btn btn--ghost" onClick={onQuickRandom}>
            vs Random
          </button>
        )}
      </div>
    </section>
  );
}
