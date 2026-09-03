import { useMemo } from "react";
import { controlHints } from "@/input/keymap";
import { input } from "@/input/InputManager";

/** The whole control scheme, always on screen. Ten seconds to understand. */
export function ControlsStrip() {
  const hints = useMemo(() => controlHints(input.getKeymap()), []);
  return (
    <div className="controls-strip">
      {hints.map(([keys, label]) => (
        <span key={label}>
          <kbd>{keys}</kbd>
          {label}
        </span>
      ))}
    </div>
  );
}
