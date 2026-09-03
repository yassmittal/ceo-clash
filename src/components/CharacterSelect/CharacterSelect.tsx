import { CHARACTER_LIST } from "@/characters";
import type { CharacterDef } from "@/game/types";
import { useGameStore } from "@/state/gameStore";
import { audio } from "@/audio/AudioManager";

const STAT_KEYS = ["speed", "attack", "defense", "aggression"] as const;

function Card({ def, onSelect }: { def: CharacterDef; onSelect: () => void }) {
  return (
    <div
      className={`card card--${def.id}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div>
        <div className="role">{def.title}</div>
        <h2 style={{ color: def.colors.primary }}>{def.name}</h2>
      </div>

      <div className="tagline">{def.tagline}</div>

      <div>
        {STAT_KEYS.map((key) => (
          <div className="stat" key={key}>
            <span>{key}</span>
            <div className="stat-track">
              <div
                className="stat-fill"
                style={{ width: `${def.stats[key]}%`, background: def.colors.primary }}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="role">special</div>
        <div className="special-name">{def.special.name}</div>
        <div className="tagline" style={{ minHeight: 0 }}>
          {def.special.description}
        </div>
      </div>

      <button className="btn" onClick={onSelect} tabIndex={-1}>
        Select
      </button>
    </div>
  );
}

export function CharacterSelect() {
  const selectCharacter = useGameStore((s) => s.selectCharacter);
  const goToMenu = useGameStore((s) => s.goToMenu);

  return (
    <div className="screen">
      <h2 className="title" style={{ fontSize: "clamp(1.8rem, 6vw, 4rem)" }}>
        Choose your CEO
      </h2>
      <p className="subtitle">the other one gets handled by the machine</p>

      <div className="select-grid">
        {CHARACTER_LIST.map((def) => (
          <Card
            key={def.id}
            def={def}
            onSelect={() => {
              audio.unlock();
              audio.click();
              selectCharacter(def.id);
            }}
          />
        ))}
      </div>

      <button className="btn btn--ghost" onClick={goToMenu}>
        Back
      </button>
    </div>
  );
}
