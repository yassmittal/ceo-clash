import { create } from "zustand";
import type { FighterId, GamePhase, Side } from "@/game/types";
import { FIGHTER_IDS } from "@/characters";

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
  /** Open character select. `step: "opponent"` skips straight to picking a
   *  new opponent for the fighter you already have. */
  goToSelect: (step?: SelectStep) => void;
  /** Which half of the two-step select the screen opens on. */
  selectStep: SelectStep;
  /** Lock in a pair and start loading the match. */
  selectCharacter: (playerId: FighterId, opponentId: FighterId) => void;
  setPhase: (p: GamePhase) => void;
  setCountdown: (n: number | null) => void;
  syncHud: (s: Partial<HudSnapshot>) => void;
  announce: (text: string, kind?: Announcement["kind"]) => void;
  expireAnnouncement: (id: number) => void;
  declareWinner: (side: Side, line: string) => void;
  rematch: () => void;
  toggleMute: () => void;
}

export type SelectStep = "fighter" | "opponent";

let announcementId = 0;

const MAX_HP = 100;

export const useGameStore = create<GameStore>((set) => ({
  phase: "MENU",
  // Any valid pair will do: nothing is shown until select has set a real one.
  playerId: FIGHTER_IDS[0],
  opponentId: FIGHTER_IDS[1],
  selectStep: "fighter",
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
  goToSelect: (step = "fighter") =>
    set({ phase: "CHARACTER_SELECT", selectStep: step, winner: null, announcements: [] }),

  // Goes through LOADING rather than straight to the countdown: only the chosen
  // pair's heads are fetched (see game/Game.tsx), and the countdown waits for
  // them instead of letting a head pop in during "3, 2, 1".
  selectCharacter: (playerId, opponentId) =>
    set((s) => ({
      playerId,
      opponentId,
      phase: "LOADING",
      countdown: null,
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
