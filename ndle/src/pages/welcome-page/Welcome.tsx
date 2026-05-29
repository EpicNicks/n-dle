import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NdleRow } from "../../components/tile/TileRow";
import {
  pickWord,
  minWordLength,
  maxWordLength,
  maxGuesses as defaultMaxGuesses,
} from "../../lib/WordPicker";
import { colorGuess } from "../../lib/GuessColorer";
import { encodeWord } from "../../lib/WordHash";
import "./Welcome.css";

const NDLE = "NDLE";
const MIN = minWordLength();
const MAX = maxWordLength();

const MIN_GUESSES = 1;
const MAX_GUESSES = 50;

let hasPlayedIntro = false;

function buildParam(encoded: string, guesses: number | null): string {
  return guesses == null ? encoded : `${encoded}-${guesses}`;
}

type ModeId = "random" | "custom" | "multiplayer";

interface ModeDef {
  id: ModeId;
  tabLabel: string;
  playButtonLabel: string;
}

const MODES: ModeDef[] = [
  { id: "random", tabLabel: "Random", playButtonLabel: "Play" },
  { id: "custom", tabLabel: "Custom", playButtonLabel: "Play custom" },
  {
    id: "multiplayer",
    tabLabel: "Multiplayer",
    playButtonLabel: "Play with friends",
  },
];

export function WelcomePage() {
  const navigate = useNavigate();
  const [isIntro, setIsIntro] = useState(() => !hasPlayedIntro);
  const backingWord = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    if (Math.floor(Math.random() * 100) === 0) {
      return "NDLE";
    }
    return pickWord(4);
  }, []);
  const states = useMemo(() => colorGuess(NDLE, backingWord), [backingWord]);

  const [mode, setMode] = useState<ModeId>("random");

  const [letterCount, setLetterCount] = useState(5);
  const [inputVal, setInputVal] = useState("5");
  const [randomGuesses, setRandomGuesses] = useState<number | null>(null);

  const [customWord, setCustomWord] = useState("");
  const [customGuesses, setCustomGuesses] = useState<number | null>(null);

  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    hasPlayedIntro = true;
  }, []);

  useEffect(() => {
    if (!isIntro) return;
    const totalIntroMs = 2100;
    const t = setTimeout(() => setIsIntro(false), totalIntroMs);
    return () => clearTimeout(t);
  }, [isIntro]);

  function handleCountChange(val: string) {
    setInputVal(val);
    if (val === "") return;
    const n = Math.min(MAX, Math.max(MIN, Number(val)));
    setLetterCount(n);
  }

  function handleBlur() {
    const n = Math.min(MAX, Math.max(MIN, Number(inputVal) || 5));
    setLetterCount(n);
    setInputVal(String(n));
  }

  function decrement() {
    const n = Math.max(MIN, letterCount - 1);
    setLetterCount(n);
    setInputVal(String(n));
  }

  function increment() {
    const n = Math.min(MAX, letterCount + 1);
    setLetterCount(n);
    setInputVal(String(n));
  }

  const sanitizedCustom = customWord.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const customValid = sanitizedCustom.length > 0;

  const canPlay = mode === "custom" ? customValid : true;

  function handlePlay() {
    if (mode === "random") {
      const word = pickWord(letterCount);
      navigate(`/game/${buildParam(encodeWord(word), randomGuesses)}`);
    } else if (mode === "custom") {
      if (!customValid) return;
      navigate(
        `/game/${buildParam(encodeWord(sanitizedCustom), customGuesses)}`,
      );
    } else if (mode === "multiplayer") {
      navigate("/multiplayer");
    }
  }

  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div className="welcome">
      <div className="welcome__logo" aria-label="ndle">
        <NdleRow
          tiles={
            revealed
              ? NDLE.split("").map((letter, i) => ({
                  letter,
                  state: states[i],
                }))
              : NDLE.split("").map((letter) => ({
                  letter,
                  state: "filled" as const,
                }))
          }
          length={NDLE.length}
          revealed={revealed}
          staggerMs={200}
        />
        <span className="welcome__bang">!</span>
      </div>
      <p className="welcome__guess">
        ( {backingWord.toUpperCase()}
        {backingWord === NDLE ? " !" : ""} )
      </p>

      <p className="welcome__sub">Guess the word in a fair amount of tries!</p>

      <div className="welcome__tabs" role="tablist" aria-label="Game mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            className={[
              "welcome__tab",
              mode === m.id ? "welcome__tab--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setMode(m.id)}
          >
            {m.tabLabel}
          </button>
        ))}
      </div>

      <div
        className={
          isIntro ? "welcome__config welcome__config--intro" : "welcome__config"
        }
        key={mode}
      >
        {mode === "random" && (
          <>
            <label className="welcome__label" htmlFor="letter-count">
              Word length
            </label>
            <div className="welcome__stepper">
              <button
                className="welcome__step"
                onClick={decrement}
                aria-label="decrease"
              >
                -
              </button>
              <input
                id="letter-count"
                className="welcome__count"
                type="number"
                min={MIN}
                max={MAX}
                value={inputVal}
                onChange={(e) => handleCountChange(e.target.value)}
                onBlur={handleBlur}
              />
              <button
                className="welcome__step"
                onClick={increment}
                aria-label="increase"
              >
                +
              </button>
            </div>
            <p className="welcome__range">
              {MIN}-{MAX} letters
            </p>

            <GuessCountField
              idPrefix="random"
              value={randomGuesses}
              defaultHint={defaultMaxGuesses(letterCount)}
              onChange={setRandomGuesses}
            />
          </>
        )}

        {mode === "custom" && (
          <>
            <label className="welcome__label" htmlFor="custom-word">
              Custom word
            </label>
            <input
              id="custom-word"
              className="welcome__word"
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="ANY WORD"
              value={customWord}
              onChange={(e) => setCustomWord(e.target.value)}
            />
            <p className="welcome__range">
              {sanitizedCustom.length > 0
                ? `${sanitizedCustom.length} letter${
                    sanitizedCustom.length === 1 ? "" : "s"
                  }`
                : "Letters only · any length"}
            </p>

            <GuessCountField
              idPrefix="custom"
              value={customGuesses}
              defaultHint={
                customValid ? defaultMaxGuesses(sanitizedCustom.length) : null
              }
              onChange={setCustomGuesses}
            />
          </>
        )}

        {mode === "multiplayer" && (
          <div className="welcome__mp">
            <label className="welcome__label">Play with friends</label>
            <p className="welcome__range">
              Host a room or join one by code. Race the same word, time attack,
              or HORSE.
            </p>
          </div>
        )}
      </div>

      <button
        className="welcome__play"
        onClick={handlePlay}
        disabled={!canPlay}
      >
        {activeMode.playButtonLabel}
      </button>
    </div>
  );
}

function GuessCountField({
  idPrefix,
  value,
  defaultHint,
  onChange,
}: {
  idPrefix: string;
  value: number | null;
  defaultHint: number | null;
  onChange: (n: number | null) => void;
}) {
  const enabled = value != null;
  const inputId = `${idPrefix}-guesses`;

  function clamp(n: number) {
    return Math.min(MAX_GUESSES, Math.max(MIN_GUESSES, n));
  }

  return (
    <div className="welcome__guesses">
      <label className="welcome__check">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            onChange(e.target.checked ? (defaultHint ?? 6) : null)
          }
        />
        Custom guess count
      </label>

      {enabled ? (
        <div className="welcome__stepper welcome__stepper--small">
          <button
            className="welcome__step"
            onClick={() => onChange(clamp((value ?? 0) - 1))}
            aria-label="fewer guesses"
          >
            -
          </button>
          <input
            id={inputId}
            className="welcome__count"
            type="number"
            min={MIN_GUESSES}
            max={MAX_GUESSES}
            value={value ?? ""}
            onChange={(e) => {
              if (e.target.value === "") return;
              onChange(clamp(Number(e.target.value)));
            }}
          />
          <button
            className="welcome__step"
            onClick={() => onChange(clamp((value ?? 0) + 1))}
            aria-label="more guesses"
          >
            +
          </button>
        </div>
      ) : (
        <p className="welcome__range">
          {defaultHint != null ? `${defaultHint} guesses (default)` : "default"}
        </p>
      )}
    </div>
  );
}
