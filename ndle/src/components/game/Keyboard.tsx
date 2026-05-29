import { useMemo } from "react";
import { type LetterResult } from "../tile/TileRow";
import { deriveLetterStates } from "./KeyboardState";

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
];

export interface KeyboardProps {
  guesses: LetterResult[][];
  onKey: (key: string) => void;
  disabled?: boolean;
}

export function Keyboard({ guesses, onKey, disabled = false }: KeyboardProps) {
  const letterStates = useMemo(() => deriveLetterStates(guesses), [guesses]);

  return (
    <div className="game__keyboard">
      {KEYBOARD_ROWS.map((row, ri) => (
        <div key={ri} className="game__keyboard-row">
          {row.map((key) => {
            const state = letterStates.get(key) ?? "untried";
            return (
              <button
                disabled={disabled}
                key={key}
                className={[
                  "game__key",
                  key === "ENTER" || key === "⌫" ? "game__key--wide" : "",
                  `game__key--${state}`,
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onKey(key)}
                aria-label={key === "⌫" ? "backspace" : key}
              >
                {key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
