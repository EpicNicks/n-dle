import { type LetterResult } from "../tile/TileRow";
import { type TileState } from "../tile/Tile";

export const STATE_EMOJI: Record<TileState, string> = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
  empty: "⬛",
  filled: "⬛",
};

/** Render a guess grid as the shareable emoji block. */
export function shareGrid(guesses: LetterResult[][]): string {
  return guesses
    .map((row) => row.map(({ state }) => STATE_EMOJI[state]).join(""))
    .join("\n");
}
