import { useEffect, useRef } from "react";
import { CHARACTERS } from "@/characters";
import { useGameStore } from "@/state/gameStore";

/**
 * The in-game HUD. It reads the throttled snapshot the simulation publishes, so
 * nothing here runs at 60fps.
 */

function HealthBar({
  hp,
  side,
  color,
}: {
  hp: number;
  side: "left" | "right";
  color: string;
}) {
  // The white "ghost" bar lags behind by a beat so you can see what a hit cost.
  return (
    <div className={`health health--${side} ${hp <= 25 ? "low" : ""}`}>
      <div className="health-ghost" style={{ width: `${hp}%` }} />
      <div
        className="health-fill"
        style={{
          width: `${hp}%`,
          background: hp <= 25 ? "var(--danger)" : color,
        }}
      />
    </div>
  );
}

function Meter({ value, side }: { value: number; side: "left" | "right" }) {
  const ready = value >= 100;
  return (
    <>
      <div className="meter">
        <div className="meter-fill" style={{ width: `${value}%` }} />
      </div>
      <div className={`meter-label ${ready ? "ready" : ""}`}>
        {side === "left" ? (ready ? "SPECIAL READY — SPACE" : "SPECIAL CHARGING") : ready ? "SPECIAL READY" : "SPECIAL CHARGING"}
      </div>
    </>
  );
}

function Announcements() {
  const announcements = useGameStore((s) => s.announcements);
  const expire = useGameStore((s) => s.expireAnnouncement);
  const timers = useRef(new Map<number, number>());

  useEffect(() => {
    for (const a of announcements) {
      if (timers.current.has(a.id)) continue;
      const handle = window.setTimeout(() => {
        timers.current.delete(a.id);
        expire(a.id);
      }, a.kind === "big" ? 1400 : 900);
      timers.current.set(a.id, handle);
    }
  }, [announcements, expire]);

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) window.clearTimeout(handle);
      map.clear();
    };
  }, []);

  return (
    <div className="announcements">
      {announcements.map((a) => (
        <div key={a.id} className={`announce announce--${a.kind}`}>
          {a.text}
        </div>
      ))}
    </div>
  );
}

export function Hud() {
  const playerId = useGameStore((s) => s.playerId);
  const opponentId = useGameStore((s) => s.opponentId);
  const playerHp = useGameStore((s) => s.playerHp);
  const opponentHp = useGameStore((s) => s.opponentHp);
  const playerMeter = useGameStore((s) => s.playerMeter);
  const opponentMeter = useGameStore((s) => s.opponentMeter);
  const timer = useGameStore((s) => s.timer);

  const player = CHARACTERS[playerId];
  const opponent = CHARACTERS[opponentId];

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="bar-block">
          <div className="bar-name" style={{ color: player.colors.primary }}>
            {player.name} <span className="bar-tag">YOU</span>
          </div>
          <HealthBar hp={playerHp} side="left" color={player.colors.primary} />
          <Meter value={playerMeter} side="left" />
        </div>

        <div className={`timer ${timer <= 10 ? "urgent" : ""}`}>{timer}</div>

        <div className="bar-block bar-block--right">
          <div className="bar-name" style={{ color: opponent.colors.primary }}>
            <span className="bar-tag">CPU</span> {opponent.name}
          </div>
          <HealthBar hp={opponentHp} side="right" color={opponent.colors.primary} />
          <Meter value={opponentMeter} side="right" />
        </div>
      </div>

      <Announcements />
    </div>
  );
}
