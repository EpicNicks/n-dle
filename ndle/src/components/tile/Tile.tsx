import { useEffect, useRef } from "react";
import "./Tile.css";

export type TileState = "empty" | "filled" | "correct" | "present" | "absent";

export interface WordleTileProps {
  letter?: string;
  state?: TileState;
  /** Stagger delay in ms for the reveal flip animation */
  revealDelay?: number;
}

export function WordleTile({
  letter = "",
  state = "empty",
  revealDelay = 0,
}: WordleTileProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  const prevLetter = useRef("");

  // Trigger pop animation on new letter
  useEffect(() => {
    if (letter && letter !== prevLetter.current && tileRef.current) {
      const el = tileRef.current;
      el.classList.remove("wordle-tile--pop");
      void el.offsetWidth;
      el.classList.add("wordle-tile--pop");
    }
    prevLetter.current = letter;
  }, [letter]);

  const isRevealed =
    state === "correct" || state === "present" || state === "absent";

  return (
    <div
      ref={tileRef}
      className={[
        "wordle-tile",
        letter ? "wordle-tile--filled" : "",
        isRevealed ? `wordle-tile--${state}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--reveal-delay": `${revealDelay}ms` } as React.CSSProperties}
      aria-label={letter ? `${letter}, ${state}` : "empty"}
      aria-live="polite"
    >
      <div className="wordle-tile__inner">{letter}</div>
    </div>
  );
}
