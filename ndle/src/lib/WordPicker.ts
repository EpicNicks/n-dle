import words from "../assets/words/dictionary.ndl?raw";

const wordCache = {
  letterCount: -1,
  cache: [] as string[],
};

const validateCache = {
  isValid: false as boolean,
  word: "" as string,
};

function randomElement<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function validateWord(word: string): boolean {
  if (validateCache.word.toUpperCase() == word.toUpperCase()) {
    return validateCache.isValid;
  }
  if (wordCache.letterCount === word.length) {
    const isValid = wordCache.cache.some(
      (w) => w.toUpperCase() == word.toUpperCase(),
    );
    validateCache.isValid = isValid;
    validateCache.word = word;
    return isValid;
  }
  const startMarker = `#${word.length}`;
  const endMarker = `#${word.length + 1}`;

  const lineRegex = /[^\r\n]+/g;
  let match: RegExpExecArray | null;
  let insideTargetSection = false;

  while ((match = lineRegex.exec(words)) !== null) {
    const line = match[0].trim();

    if (line === endMarker) {
      break;
    }

    if (insideTargetSection) {
      if (line.length > 0) {
        if (line.toUpperCase() === word.toUpperCase()) {
          validateCache.isValid = true;
          validateCache.word = word;
          return true;
        }
      }
    } else if (line === startMarker) {
      insideTargetSection = true;
    }
  }

  return false;
}

export function pickWord(letterCount: number): string {
  if (letterCount == wordCache.letterCount) {
    return randomElement(wordCache.cache);
  }

  const candidates: Array<string> = [];

  const startMarker = `#${letterCount}`;
  const endMarker = `#${letterCount + 1}`;

  const lineRegex = /[^\r\n]+/g;
  let match: RegExpExecArray | null;
  let insideTargetSection = false;

  while ((match = lineRegex.exec(words)) !== null) {
    const line = match[0].trim();

    if (line === endMarker) {
      break;
    }

    if (insideTargetSection) {
      if (line.length > 0) {
        candidates.push(line);
      }
    } else if (line === startMarker) {
      insideTargetSection = true;
    }
  }

  if (candidates.length === 0) {
    return "";
  }

  wordCache.letterCount = letterCount;
  wordCache.cache = candidates;

  return randomElement(candidates);
}
