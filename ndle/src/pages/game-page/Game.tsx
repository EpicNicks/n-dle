import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WordleRow, type LetterResult } from "../../components/tile/TileRow";
import { ColorGuess } from "../../lib/GuessColorer";
import { decodeWord } from "../../lib/WordHash";
import { validateWord } from "../../lib/WordPicker";
import { WordDefinition } from "../../components/definition/Definition";
import type { TileState } from "../../components/tile/Tile";
import "./Game.css";

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
];

type GameStatus = "playing" | "won" | "lost";

/** Best state wins: correct > present > absent > untried */
const STATE_PRIORITY: Record<TileState | "untried", number> = {
  correct: 3,
  present: 2,
  absent: 1,
  untried: 0,
  empty: 0,
  filled: 0,
};

export function GamePage() {
  const { wordHash } = useParams<{ wordHash: string }>();
  const navigate = useNavigate();
  const word = useMemo(() => decodeWord(wordHash ?? ""), [wordHash]);
  const wordLength = word.length;
  const maxGuesses = wordLength + 1;

  const [guesses, setGuesses] = useState<LetterResult[][]>([]);
  const [current, setCurrent] = useState<string>("");
  const [revealedRows, setRevealedRows] = useState<boolean[]>([]);
  const [shakingRow, setShakingRow] = useState<number | null>(null);
  const [status, setStatus] = useState<GameStatus>("playing");

  // Map each letter to its best known state for the keyboard
  const letterStates = useMemo(() => {
    const map = new Map<string, TileState>();
    guesses.forEach((row) => {
      row.forEach(({ letter, state }) => {
        const cur = map.get(letter) ?? "empty";
        if (STATE_PRIORITY[state] > STATE_PRIORITY[cur]) {
          map.set(letter, state);
        }
      });
    });
    return map;
  }, [guesses]);

  const submitGuess = useCallback(() => {
    if (current.length !== wordLength) {
      setShakingRow(guesses.length);
      return;
    }

    if (!validateWord(current)) {
      setShakingRow(guesses.length);
      return;
    }

    const states = ColorGuess(current, word);
    const row: LetterResult[] = current
      .split("")
      .map((letter, i) => ({ letter, state: states[i] }));

    const newGuesses = [...guesses, row];
    setGuesses(newGuesses);
    setCurrent("");

    // Reveal after a short delay so tiles paint filled first
    setTimeout(() => {
      setRevealedRows((prev) => {
        const next = [...prev];
        next[newGuesses.length - 1] = true;
        return next;
      });

      const won = states.every((s) => s === "correct");
      if (won) {
        setStatus("won");
      } else if (newGuesses.length >= maxGuesses) {
        setStatus("lost");
      }
    }, 100);
  }, [current, guesses, word, wordLength, maxGuesses]);

  const handleKey = useCallback(
    (key: string) => {
      if (status !== "playing") return;

      if (key === "ENTER") {
        submitGuess();
      } else if (key === "⌫" || key === "BACKSPACE") {
        setCurrent((c) => c.slice(0, -1));
      } else if (/^[A-Z]$/.test(key) && current.length < wordLength) {
        setCurrent((c) => c + key);
      }
    },
    [status, current, wordLength, submitGuess],
  );

  // Physical keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKey(e.key.toUpperCase());
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKey]);

  if (!word) {
    return <div className="game__error">Invalid game link.</div>;
  }

  const gameOver = status === "won" || status === "lost";

  // Build the full board: past guesses + current row + empty rows
  const board: { tiles: LetterResult[]; rowIndex: number }[] = [];

  for (let i = 0; i < maxGuesses; i++) {
    if (i < guesses.length) {
      board.push({ tiles: guesses[i], rowIndex: i });
    } else if (i === guesses.length && status === "playing") {
      const tiles: LetterResult[] = current
        .split("")
        .map((letter) => ({ letter, state: "filled" as TileState }));
      board.push({ tiles, rowIndex: i });
    } else {
      board.push({ tiles: [], rowIndex: i });
    }
  }

  return (
    <div className="game">
      <button className="game__home" onClick={() => navigate("/")}>
        ← NDLE!
      </button>

      {status === "won" && (
        <div className="game__banner game__banner--won">🎉 You got it!</div>
      )}
      {status === "lost" && (
        <div className="game__banner game__banner--lost">
          The word was <strong>{word}</strong>
        </div>
      )}

      <div className="game__board">
        {board.map(({ tiles, rowIndex }) => (
          <WordleRow
            key={rowIndex}
            tiles={tiles}
            length={wordLength}
            revealed={revealedRows[rowIndex] ?? false}
            shaking={shakingRow === rowIndex}
            onShakeEnd={() => setShakingRow(null)}
          />
        ))}
      </div>

      {gameOver && <WordDefinition word={word} />}

      {!gameOver && (
        <div className="game__keyboard">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} className="game__keyboard-row">
              {row.map((key) => {
                const state = letterStates.get(key) ?? "untried";
                return (
                  <button
                    key={key}
                    className={[
                      "game__key",
                      key === "ENTER" || key === "⌫" ? "game__key--wide" : "",
                      `game__key--${state}`,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleKey(key)}
                    aria-label={key === "⌫" ? "backspace" : key}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
