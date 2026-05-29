import { type LetterResult } from "../tile/TileRow";
import { type TileState } from "../tile/Tile";

// Best-known state per letter, "best wins". Lives in its own (non-component)
// module so Keyboard.tsx can export only the component (react-refresh rule).
const STATE_PRIORITY: Record<TileState | "untried", number> = {
  correct: 3,
  present: 2,
  absent: 1,
  untried: 0,
  empty: 0,
  filled: 0,
};

export function deriveLetterStates(
  guesses: LetterResult[][],
): Map<string, TileState> {
  const map = new Map<string, TileState>();
  for (const row of guesses) {
    for (const { letter, state } of row) {
      const cur = map.get(letter) ?? "empty";
      if (STATE_PRIORITY[state] > STATE_PRIORITY[cur]) map.set(letter, state);
    }
  }
  return map;
}
