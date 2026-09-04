import type { CharacterDef } from "@/game/types";

/**
 * The fighter's face, as shown in the DOM UI.
 *
 * It is the same cropped photo the 3D head wears, so the card you picked and
 * the fighter that walks out are unmistakably the same person. The character's
 * colour is laid over it as a duotone wash, which both ties it to the rest of
 * the card and stops two photographs from two different press events sitting
 * next to each other looking like two different lighting setups.
 */
export function Portrait({
  def,
  size = "card",
}: {
  def: CharacterDef;
  size?: "card" | "hero";
}) {
  return (
    <div className={`portrait portrait--${size} portrait--${def.id}`}>
      <img
        src={`${import.meta.env.BASE_URL}faces/${def.id}.webp`}
        alt={`${def.name}, the ${def.title.toLowerCase()}`}
        draggable={false}
      />
      <span className="portrait-wash" style={{ background: def.colors.primary }} />
      <span className="portrait-scan" />
    </div>
  );
}
