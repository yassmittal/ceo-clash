import { create } from "zustand";
import type { FighterId, GamePhase, Side } from "@/game/types";
import { other } from "@/characters";

/**
 * GLOBAL GAME STATE ONLY.
 *
 * This store holds what the *UI* needs to render: the phase, health bars, meters,
 * the clock, announcements. It deliberately does NOT hold positions, velocities,
 * animation timers or hitbox bookkeeping — that lives in the mutable runtime
 * (src/game/runtime.ts) so the 60fps simulation never triggers a React render.
 *
 * The simulation pushes a summary into here a few times a second via `syncHud`.
 */

export interface Announcement {
  id: number;
  text: string;
  kind: "hit" | "big" | "info";
}

export interface HudSnapshot {
  playerHp: number;
  opponentHp: number;
  playerMeter: number;
  opponentMeter: number;
  timer: number;
}

interface GameStore extends HudSnapshot {
  phase: GamePhase;
  playerId: FighterId;
  opponentId: FighterId;
  /** 3 / 2 / 1 / 0 (=FIGHT!). null when not counting down. */
  countdown: number | null;
  winner: Side | null;
  winnerLine: string;
  announcements: Announcement[];
  muted: boolean;
  /** Bumped on every rematch so the arena remounts cleanly. */
  matchKey: number;

  goToMenu: () => void;
  goToSelect: () => void;
  selectCharacter: (id: FighterId) => void;
  setPhase: (p: GamePhase) => void;
  setCountdown: (n: number | null) => void;
  syncHud: (s: Partial<HudSnapshot>) => void;
  announce: (text: string, kind?: Announcement["kind"]) => void;
  expireAnnouncement: (id: number) => void;
  declareWinner: (side: Side, line: string) => void;
  rematch: () => void;
  toggleMute: () => void;
}

let announcementId = 0;

const MAX_HP = 100;

export const useGameStore = create<GameStore>((set) => ({
  phase: "MENU",
  playerId: "sam",
  opponentId: "dario",
  playerHp: MAX_HP,
  opponentHp: MAX_HP,
  playerMeter: 0,
  opponentMeter: 0,
  timer: 90,
  countdown: null,
  winner: null,
  winnerLine: "",
  announcements: [],
  muted: false,
  matchKey: 0,

  goToMenu: () =>
    set({ phase: "MENU", winner: null, announcements: [], countdown: null }),
  goToSelect: () => set({ phase: "CHARACTER_SELECT", winner: null, announcements: [] }),

  selectCharacter: (id) =>
    set((s) => ({
      playerId: id,
      opponentId: other(id),
      phase: "COUNTDOWN",
      countdown: 3,
      playerHp: MAX_HP,
      opponentHp: MAX_HP,
      playerMeter: 0,
      opponentMeter: 0,
      timer: 90,
      winner: null,
      winnerLine: "",
      announcements: [],
      matchKey: s.matchKey + 1,
    })),

  setPhase: (p) => set({ phase: p }),
  setCountdown: (n) => set({ countdown: n }),
  syncHud: (s) => set(s),

  announce: (text, kind = "hit") =>
    set((s) => {
      const id = ++announcementId;
      // Keep the feed short — the plan says a few good jokes, not a wall of text.
      const next = [...s.announcements, { id, text, kind }].slice(-3);
      return { announcements: next };
    }),

  expireAnnouncement: (id) =>
    set((s) => ({ announcements: s.announcements.filter((a) => a.id !== id) })),

  declareWinner: (side, line) => set({ phase: "WINNER", winner: side, winnerLine: line }),

  rematch: () =>
    set((s) => ({
      phase: "COUNTDOWN",
      countdown: 3,
      playerHp: MAX_HP,
      opponentHp: MAX_HP,
      playerMeter: 0,
      opponentMeter: 0,
      timer: 90,
      winner: null,
      winnerLine: "",
      announcements: [],
      matchKey: s.matchKey + 1,
    })),

  toggleMute: () => set((s) => ({ muted: !s.muted })),
}));

export const MAX_HEALTH = MAX_HP;
