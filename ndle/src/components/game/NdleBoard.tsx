import { type CSSProperties } from "react";
import { NdleRow, type LetterResult } from "../tile/TileRow";
import { type TileState } from "../tile/Tile";

// ---------------------------------------------------------------------------
// Presentational board. Builds the same row structure GamePage built inline,
// but as a reusable component rendering your WordleRow (flip/shake/bounce).
//
//   - solo & multiplayer self board: pass current + status so the in-progress
//     row shows the letters being typed.
//   - multiplayer opponent board: pass hideLetters so graded tiles show colour
//     but not the letter until reveal.
// ---------------------------------------------------------------------------

export interface NdleBoardProps {
  guesses: LetterResult[][];
  wordLength: number;
  maxGuesses: number;
  revealedRows?: boolean[];
  /** In-progress row contents (self boards). Ignored when hideLetters is set. */
  current?: string;
  /** Show the typing row only while still playing. */
  active?: boolean;
  shakingRow?: number | null;
  onShakeEnd?: () => void;
  /** Opponent view: strip letters from graded rows, keep colour. */
  hideLetters?: boolean;
  /** Opponent view: how many tiles of the in-progress row are filled. */
  typingRow?: number;
  typingFilled?: number;
}

export function NdleBoard({
  guesses,
  wordLength,
  maxGuesses,
  revealedRows,
  current = "",
  active = true,
  shakingRow = null,
  onShakeEnd,
  hideLetters = false,
  typingRow,
  typingFilled,
}: NdleBoardProps) {
  const rows: { tiles: LetterResult[]; rowIndex: number; revealed: boolean }[] =
    [];

  for (let i = 0; i < maxGuesses; i++) {
    if (i < guesses.length) {
      const tiles = hideLetters
        ? guesses[i].map((t) => ({ letter: "", state: t.state }))
        : guesses[i];
      rows.push({ tiles, rowIndex: i, revealed: revealedRows?.[i] ?? true });
    } else if (!hideLetters && i === guesses.length && active) {
      // self: render the letters currently being typed
      const tiles: LetterResult[] = current
        .split("")
        .map((letter) => ({ letter, state: "filled" as TileState }));
      rows.push({ tiles, rowIndex: i, revealed: false });
    } else if (hideLetters && i === typingRow) {
      // opponent: show filled placeholders (no letters) for their current row
      const tiles: LetterResult[] = Array.from({
        length: typingFilled ?? 0,
      }).map(() => ({
        letter: " ", // non-empty so WordleRow renders the "filled" border
        state: "filled" as TileState,
      }));
      rows.push({ tiles, rowIndex: i, revealed: false });
    } else {
      rows.push({ tiles: [], rowIndex: i, revealed: false });
    }
  }

  return (
    <div
      className="game__board"
      style={{ "--word-length": wordLength } as CSSProperties}
    >
      {rows.map(({ tiles, rowIndex, revealed }) => (
        <NdleRow
          key={rowIndex}
          tiles={tiles}
          length={wordLength}
          revealed={revealed}
          shaking={shakingRow === rowIndex}
          onShakeEnd={onShakeEnd}
        />
      ))}
    </div>
  );
}
