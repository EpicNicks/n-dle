import { useEffect, useRef } from "react";
import { WordleTile, type TileState } from "./Tile.tsx";

export interface LetterResult {
  letter: string;
  state: TileState;
}

export interface WordleRowProps {
  /** Array of up to 5 letter+state pairs */
  tiles: LetterResult[];
  /** Total columns (default 5) */
  length?: number;
  /** Whether to play the reveal flip animation */
  revealed?: boolean;
  /** Whether to play the shake animation (invalid word) */
  shaking?: boolean;
  /** Called when the shake animation ends */
  onShakeEnd?: () => void;
  /** Delay between each tile's flip in ms (default 150) */
  staggerMs?: number;
}

export function WordleRow({
  tiles,
  length = 5,
  revealed = false,
  shaking = false,
  onShakeEnd,
  staggerMs = 150,
}: WordleRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shaking || !rowRef.current) return;
    const el = rowRef.current;
    el.classList.remove("wordle-row--shake");
    void el.offsetWidth;
    el.classList.add("wordle-row--shake");
    const handler = () => onShakeEnd?.();
    el.addEventListener("animationend", handler, { once: true });
    return () => el.removeEventListener("animationend", handler);
  }, [shaking, onShakeEnd]);

  const columns = Array.from({ length }, (_, i) => {
    const tile = tiles[i];
    return {
      letter: tile?.letter ?? "",
      state: revealed && tile ? tile.state : tile?.letter ? "filled" : "empty",
    } as LetterResult;
  });

  return (
    <div ref={rowRef} className="wordle-row" role="group" aria-label="word row">
      {columns.map((col, i) => (
        <WordleTile
          key={i}
          letter={col.letter}
          state={col.state as TileState}
          revealDelay={revealed ? i * staggerMs : 0}
        />
      ))}
    </div>
  );
}
