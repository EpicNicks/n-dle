import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WordleTile } from "../../components/tile/Tile";
import { pickWord, minWordLength, maxWordLength } from "../../lib/WordPicker";
import { ColorGuess } from "../../lib/GuessColorer";
import { encodeWord } from "../../lib/WordHash";
import "./Welcome.css";

const NDLE = "NDLE";
const MIN = minWordLength();
const MAX = maxWordLength();

export function WelcomePage() {
  const navigate = useNavigate();
  const backingWord = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    if (Math.floor(Math.random() * 100) === 0) {
      return "NDLE";
    }
    return pickWord(4);
  }, []);
  const states = useMemo(() => ColorGuess(NDLE, backingWord), [backingWord]);

  const [letterCount, setLetterCount] = useState(5);
  const [inputVal, setInputVal] = useState("5");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(t);
  }, []);

  function handlePlay() {
    const word = pickWord(letterCount);
    navigate(`/game/${encodeWord(word)}`);
  }

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

  return (
    <div className="welcome">
      <div className="welcome__logo" aria-label="ndle">
        {NDLE.split("").map((letter, i) => (
          <WordleTile
            key={letter}
            letter={letter}
            state={revealed ? states[i] : "filled"}
            revealDelay={i * 200}
          />
        ))}
        <span className="welcome__bang">!</span>
      </div>
      <p className="welcome__guess">({backingWord.toUpperCase()})</p>

      <p className="welcome__sub">Guess the word in a fair amount of tries!</p>

      <div className="welcome__config">
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
      </div>

      <button className="welcome__play" onClick={handlePlay}>
        Play
      </button>
    </div>
  );
}
