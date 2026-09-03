import { Game } from "@/game/Game";
import { Overlay } from "@/components/UI/Overlay";

export default function App() {
  return (
    <div className="app">
      <div className="canvas-layer">
        <Game />
      </div>
      <Overlay />
    </div>
  );
}
