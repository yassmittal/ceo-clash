import { useGameStore } from "@/state/gameStore";

export function Countdown() {
  const countdown = useGameStore((s) => s.countdown);
  if (countdown === null) return null;
  const isFight = countdown === 0;
  return (
    <div className="countdown">
      <div
        key={countdown}
        className={`countdown-number ${isFight ? "fight" : ""}`}
      >
        {isFight ? "FIGHT!" : countdown}
      </div>
    </div>
  );
}
