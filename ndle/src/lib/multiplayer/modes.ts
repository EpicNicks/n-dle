import {
  type GameConfig,
  type GameModeId,
  type PlayerInfo,
  type RoomState,
} from "./types";

export interface ModeMeta {
  id: GameModeId;
  label: string;
  blurb: string;
  /** Whether the host configures a per-round time limit at creation. */
  hasTimer: boolean;
  /** Whether the host picks a fixed word length up front (horse picks per-round). */
  hasFixedLength: boolean;
}

export const MODES: ModeMeta[] = [
  {
    id: "plain",
    label: "Classic",
    blurb:
      "Everyone races the same word. Colours show live; letters reveal once all are done.",
    hasTimer: false,
    hasFixedLength: true,
  },
  {
    id: "timeAttack",
    label: "Time Attack",
    blurb:
      "Solve as many words as you can before the clock runs out. +1 per solve, −1 per fail.",
    hasTimer: true,
    hasFixedLength: true,
  },
  {
    id: "horse",
    label: "Horse",
    blurb:
      "Match the challenger's word in as few guesses. Miss and you earn a letter — spell HORSE and you're out.",
    hasTimer: false,
    hasFixedLength: false,
  },
];

export function buildConfig(
  mode: GameModeId,
  opts: { wordLength: number; durationSeconds: number },
): GameConfig {
  switch (mode) {
    case "plain":
      return { mode, wordLength: opts.wordLength };
    case "timeAttack":
      return {
        mode,
        wordLength: opts.wordLength,
        durationSeconds: opts.durationSeconds,
      };
    case "horse":
      return { mode };
  }
}

export function formatClock(msRemaining: number): string {
  const s = Math.max(0, Math.ceil(msRemaining / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** HORSE progress as a fixed 5-slot string, e.g. "HOR.." for display. */
export function horseDisplay(letters = ""): string {
  return "HORSE"
    .split("")
    .map((ch, i) => (i < letters.length ? ch : "·"))
    .join("");
}

export function isEliminated(p: PlayerInfo): boolean {
  return (p.horseLetters?.length ?? 0) >= 5;
}

/** Ranked standings for the finished screen, per mode. */
export function standings(state: RoomState): PlayerInfo[] {
  const players = [...state.players];
  switch (state.config.mode) {
    case "timeAttack":
      return players.sort((a, b) => (b.taScore ?? 0) - (a.taScore ?? 0));
    case "horse":
      // fewest HORSE letters first; eliminated sink to the bottom
      return players.sort(
        (a, b) => (a.horseLetters?.length ?? 0) - (b.horseLetters?.length ?? 0),
      );
    case "plain":
    default:
      // solved-in-fewest-guesses first, fails last
      return players.sort((a, b) => {
        const ra = state.reveal?.[a.id];
        const rb = state.reveal?.[b.id];
        const ka = ra?.outcome === "solved" ? ra.rows.length : Infinity;
        const kb = rb?.outcome === "solved" ? rb.rows.length : Infinity;
        return ka - kb;
      });
  }
}
