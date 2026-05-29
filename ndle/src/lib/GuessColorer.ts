import type { TileState } from "../components/tile/Tile";

export function colorGuess(guess: string, word: string): Array<TileState> {
  const states: Array<TileState> = Array(guess.length).fill("absent");
  if (guess.length !== word.length) {
    console.log("guess " + guess + " word " + word);
    return [];
  }
  const letters = Array(26).fill(0);

  function letterIndex(char: string) {
    return char.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
  }

  for (let i = 0; i < guess.length; i++) {
    if (guess.at(i)?.toUpperCase() === word.at(i)?.toUpperCase()) {
      states[i] = "correct";
    } else {
      letters[letterIndex(word[i])]++;
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (states[i] !== "correct" && letters[letterIndex(guess[i])] > 0) {
      letters[letterIndex(guess[i])]--;
      states[i] = "present";
    }
  }

  return states;
}
