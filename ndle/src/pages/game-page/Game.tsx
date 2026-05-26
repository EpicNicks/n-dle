import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WordleRow, type LetterResult } from "../../components/tile/TileRow";
import { ColorGuess } from "../../lib/GuessColorer";
import { decodeWord } from "../../lib/WordHash";
import * as WordPicker from "../../lib/WordPicker";
import { WordDefinition } from "../../components/definition/Definition";
import type { TileState } from "../../components/tile/Tile";
import "./Game.css";

const KEYBOARD_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
];

type GameStatus = "playing" | "won" | "lost";

const STATE_PRIORITY: Record<TileState | "untried", number> = {
  correct: 3,
  present: 2,
  absent: 1,
  untried: 0,
  empty: 0,
  filled: 0,
};

const STATE_EMOJI: Record<TileState, string> = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
  empty: "⬛",
  filled: "⬛",
};

const EXPIRY_MS = 24 * 60 * 60 * 1000;

interface PersistedState {
  guesses: LetterResult[][];
  status: GameStatus;
  savedAt: number;
}

function loadState(key: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: PersistedState = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > EXPIRY_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveState(key: string, guesses: LetterResult[][], status: GameStatus) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ guesses, status, savedAt: Date.now() }),
    );
  } catch {
    /* empty */
  }
}

export function GamePage() {
  const { wordHash } = useParams<{ wordHash: string }>();
  const navigate = useNavigate();
  const word = useMemo(() => decodeWord(wordHash ?? ""), [wordHash]);
  const wordLength = word.length;
  const maxGuesses = WordPicker.maxGuesses(word.length);
  const storageKey = `ndle-game-${wordHash}`;

  const saved = useMemo(() => loadState(storageKey), [storageKey]);

  const [guesses, setGuesses] = useState<LetterResult[][]>(
    saved?.guesses ?? [],
  );
  const [current, setCurrent] = useState<string>("");
  const [revealedRows, setRevealedRows] = useState<boolean[]>(
    saved ? saved.guesses.map(() => true) : [],
  );
  const [shakingRow, setShakingRow] = useState<number | null>(null);
  const [status, setStatus] = useState<GameStatus>(saved?.status ?? "playing");
  const [copied, setCopied] = useState(false);

  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist on every change
  useEffect(() => {
    saveState(storageKey, guesses, status);
  }, [storageKey, guesses, status]);

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

    if (!WordPicker.validateWord(current)) {
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKey(e.key.toUpperCase());
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKey]);

  function handleShare() {
    const guessCount = status === "won" ? guesses.length : "X";
    const grid = guesses
      .map((row) => row.map(({ state }) => STATE_EMOJI[state]).join(""))
      .join("\n");
    const text = `NDLE #${wordHash} ${guessCount}/${maxGuesses}\n\n${grid}`;

    navigator.clipboard.writeText(text).then(() => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      setCopied(true);
      copiedTimeout.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!word) {
    return <div className="game__error">Invalid game link.</div>;
  }

  const gameOver = status === "won" || status === "lost";

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

      {gameOver && (
        <button className="game__share" onClick={handleShare}>
          <div className="game__share-inner">
            {copied ? "Copied!" : "Share"}
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              height="20"
              viewBox="0 0 24 24"
              width="20"
            >
              <path
                fill="white"
                d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 7.02c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"
              />
            </svg>
          </div>
        </button>
      )}

      {gameOver && <WordDefinition word={word} />}

      <div className="game__keyboard">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="game__keyboard-row">
            {row.map((key) => {
              const state = letterStates.get(key) ?? "untried";
              return (
                <button
                  disabled={gameOver}
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
    </div>
  );
}
