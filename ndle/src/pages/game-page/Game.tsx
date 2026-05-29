import { useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { type LetterResult } from "../../components/tile/TileRow";
import { decodeWord } from "../../lib/WordHash";
import * as WordPicker from "../../lib/WordPicker";
import { WordDefinition } from "../../components/definition/Definition";
import {
  useNdleGame,
  type GameStatus,
} from "../../components/game/useNdleGame";
import { NdleBoard } from "../../components/game/NdleBoard";
import { Keyboard } from "../../components/game/Keyboard";
import { shareGrid } from "../../components/game/ShareGrid";
import "./Game.css";

const EXPIRY_MS = 24 * 60 * 60 * 1000;

interface PersistedState {
  guesses: LetterResult[][];
  status: GameStatus;
  savedAt: number;
}

function parseHashParam(raw: string): {
  encodedWord: string;
  guessOverride: number | null;
} {
  const lastDash = raw.lastIndexOf("-");
  if (lastDash === -1) return { encodedWord: raw, guessOverride: null };
  const suffix = raw.slice(lastDash + 1);
  if (/^\d+$/.test(suffix)) {
    const n = parseInt(suffix, 10);
    if (n > 0) return { encodedWord: raw.slice(0, lastDash), guessOverride: n };
  }
  return { encodedWord: raw, guessOverride: null };
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

const ShareSVG = () => (
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
);

export function GamePage() {
  const { wordHash } = useParams<{ wordHash: string }>();
  const navigate = useNavigate();

  const { encodedWord, guessOverride } = useMemo(
    () => parseHashParam(wordHash ?? ""),
    [wordHash],
  );
  const word = useMemo(() => decodeWord(encodedWord), [encodedWord]);

  const maxGuesses = useMemo(() => {
    if (guessOverride != null) return Math.max(1, guessOverride);
    return WordPicker.maxGuesses(word.length);
  }, [guessOverride, word.length]);

  const storageKey = `ndle-game-${wordHash}`;
  const saved = useMemo(() => loadState(storageKey), [storageKey]);

  const game = useNdleGame({
    word,
    maxGuesses,
    dictionary: [word], // TODO: pass your real dictionary for this length
    initialGuesses: saved?.guesses,
    initialStatus: saved?.status,
    onChange: (guesses, status) => saveState(storageKey, guesses, status),
  });

  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedLinkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleShare() {
    const guessCount = game.status === "won" ? game.guesses.length : "X";
    const text = `NDLE #${wordHash} ${guessCount}/${maxGuesses}\n\n${shareGrid(game.guesses)}`;
    navigator.clipboard.writeText(text).then(() => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      setCopied(true);
      copiedTimeout.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleShareLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      if (copiedLinkTimeout.current) clearTimeout(copiedLinkTimeout.current);
      setLinkCopied(true);
      copiedLinkTimeout.current = setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  if (!word) return <div className="game__error">Invalid game link.</div>;

  const gameOver = game.status === "won" || game.status === "lost";

  return (
    <div className="game">
      <button className="game__home" onClick={() => navigate("/")}>
        ← NDLE!
      </button>

      {game.status === "won" && (
        <div className="game__banner game__banner--won">🎉 You got it!</div>
      )}
      {game.status === "lost" && (
        <div className="game__banner game__banner--lost">
          The word was <strong>{word}</strong>
        </div>
      )}

      <NdleBoard
        guesses={game.guesses}
        wordLength={game.wordLength}
        maxGuesses={game.maxGuesses}
        revealedRows={game.revealedRows}
        current={game.current}
        active={game.status === "playing"}
        shakingRow={game.shakingRow}
        onShakeEnd={game.clearShake}
      />

      {gameOver && (
        <button className="game__share" onClick={handleShare}>
          <div className="game__share-inner">
            {copied ? "Copied!" : "Share Result"}
            <ShareSVG />
          </div>
        </button>
      )}

      {gameOver && <WordDefinition word={word} />}

      <Keyboard
        guesses={game.guesses}
        onKey={game.handleKey}
        disabled={gameOver}
      />

      <button className="game__share" onClick={handleShareLink}>
        <div className="game__share-inner">
          {linkCopied ? "Copied Link" : "Share Puzzle"}
          <ShareSVG />
        </div>
      </button>
    </div>
  );
}
