import { useCallback, useEffect, useRef, useState } from "react";
import { type LetterResult } from "../tile/TileRow";
import { type TileState } from "../tile/Tile";
import { colorGuess } from "../../lib/GuessColorer";
import * as WordPicker from "../../lib/WordPicker";

export type GameStatus = "playing" | "won" | "lost";

export interface UseNdleGameOptions {
  word: string;
  maxGuesses?: number;
  dictionary?: string[];
  initialGuesses?: LetterResult[][];
  initialStatus?: GameStatus;
  onSubmitRow?: (pattern: TileState[], row: LetterResult[]) => void;
  onType?: (filled: number) => void;
  onFinish?: (
    rows: LetterResult[][],
    status: Exclude<GameStatus, "playing">,
  ) => void;
  onChange?: (rows: LetterResult[][], status: GameStatus) => void;
}

export interface NdleGame {
  guesses: LetterResult[][];
  current: string;
  status: GameStatus;
  revealedRows: boolean[];
  shakingRow: number | null;
  maxGuesses: number;
  wordLength: number;
  handleKey: (key: string) => void;
  clearShake: () => void;
}

export function useNdleGame(opts: UseNdleGameOptions): NdleGame {
  const { word, dictionary, onSubmitRow, onType, onFinish, onChange } = opts;
  const wordLength = word.length;
  const maxGuesses = opts.maxGuesses ?? WordPicker.maxGuesses(wordLength);

  const [guesses, setGuesses] = useState<LetterResult[][]>(
    opts.initialGuesses ?? [],
  );
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState<GameStatus>(
    opts.initialStatus ?? "playing",
  );
  const [revealedRows, setRevealedRows] = useState<boolean[]>(
    opts.initialGuesses ? opts.initialGuesses.map(() => true) : [],
  );
  const [shakingRow, setShakingRow] = useState<number | null>(null);

  // Latest callbacks in a ref so submitGuess needn't depend on their identity.
  // Written in an effect, never during render, to satisfy react-hooks/refs.
  const cbs = useRef({ onSubmitRow, onType, onFinish, onChange });
  useEffect(() => {
    cbs.current = { onSubmitRow, onType, onFinish, onChange };
  }, [onSubmitRow, onType, onFinish, onChange]);

  useEffect(() => {
    cbs.current.onChange?.(guesses, status);
  }, [guesses, status]);

  useEffect(() => {
    cbs.current.onType?.(current.length);
  }, [current]);

  const submitGuess = useCallback(() => {
    if (current.length !== wordLength) {
      setShakingRow(guesses.length);
      return;
    }
    const dict = dictionary ?? [word];
    if (!WordPicker.validateWord(current, dict)) {
      setShakingRow(guesses.length);
      return;
    }
    const states = colorGuess(current, word);
    const row: LetterResult[] = current
      .split("")
      .map((letter, i) => ({ letter, state: states[i] }));
    const newGuesses = [...guesses, row];
    setGuesses(newGuesses);
    setCurrent("");
    cbs.current.onSubmitRow?.(states, row);
    setTimeout(() => {
      setRevealedRows((prev) => {
        const next = [...prev];
        next[newGuesses.length - 1] = true;
        return next;
      });
      const won = states.every((s) => s === "correct");
      if (won) {
        setStatus("won");
        cbs.current.onFinish?.(newGuesses, "won");
      } else if (newGuesses.length >= maxGuesses) {
        setStatus("lost");
        cbs.current.onFinish?.(newGuesses, "lost");
      }
    }, 100);
  }, [current, guesses, word, wordLength, maxGuesses, dictionary]);

  const handleKey = useCallback(
    (key: string) => {
      if (status !== "playing") return;
      const k = key.toUpperCase();
      if (k === "ENTER") submitGuess();
      else if (k === "⌫" || k === "BACKSPACE")
        setCurrent((c) => c.slice(0, -1));
      else if (/^[A-Z]$/.test(k))
        setCurrent((c) => (c.length < wordLength ? c + k : c));
    },
    [status, wordLength, submitGuess],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKey(e.key);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKey]);

  const clearShake = useCallback(() => setShakingRow(null), []);

  return {
    guesses,
    current,
    status,
    revealedRows,
    shakingRow,
    maxGuesses,
    wordLength,
    handleKey,
    clearShake,
  };
}
