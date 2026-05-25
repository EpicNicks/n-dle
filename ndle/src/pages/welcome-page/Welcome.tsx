import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WordleTile } from "../../components/tile/Tile";
import { pickWord } from "../../lib/WordPicker";
import { ColorGuess } from "../../lib/GuessColorer";
import "./Welcome.css";
import { encodeWord } from "../../lib/WordHash";

const NDLE = "NDLE";

export function WelcomePage() {
  const navigate = useNavigate();
  const backingWord = useMemo(() => pickWord(4), []);
  const states = useMemo(() => ColorGuess(NDLE, backingWord), [backingWord]);

  const [revealed, setRevealed] = useState(false);

  // Short delay so the page paints first, then animate
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(t);
  }, []);

  function handlePlay() {
    const word = pickWord(5);
    navigate(`/game/${encodeWord(word)}`);
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

      <p className="welcome__sub">
        A word game. Guess the N-letter word in a fair amount of tries!
      </p>
      <p>(guess: {backingWord.toUpperCase()})</p>
      <button className="welcome__play" onClick={handlePlay}>
        Play
      </button>
    </div>
  );
}
