import { useEffect, useState } from "react";
import "./Definition.css";

interface Definition {
  definition: string;
  example?: string;
}

interface Meaning {
  partOfSpeech: string;
  definitions: Definition[];
}

interface DictionaryEntry {
  phonetic?: string;
  meanings: Meaning[];
}

type FetchState = "loading" | "success" | "error";

interface WordDefinitionProps {
  word: string;
}

export function WordDefinition({ word }: WordDefinitionProps) {
  const [state, setState] = useState<FetchState>("loading");
  const [meanings, setMeanings] = useState<Meaning[]>([]);
  const [phonetic, setPhonetic] = useState<string>("");

  useEffect(() => {
    fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data: DictionaryEntry[]) => {
        const entry = data[0];
        setPhonetic(entry.phonetic ?? "");
        setMeanings(
          entry.meanings.slice(0, 3).map((m) => ({
            partOfSpeech: m.partOfSpeech,
            definitions: m.definitions.slice(0, 1),
          })),
        );
        setState("success");
      })
      .catch(() => setState("error"));
  }, [word]);

  return (
    <div className="word-def">
      <div className="word-def__header">
        <span className="word-def__word">{word.toLowerCase()}</span>
        {phonetic && <span className="word-def__phonetic">{phonetic}</span>}
      </div>

      {state === "loading" && (
        <p className="word-def__loading">Loading definition…</p>
      )}

      {state === "error" && (
        <p className="word-def__error">No definition found.</p>
      )}

      {state === "success" && (
        <ul className="word-def__meanings">
          {meanings.map((m, i) => (
            <li key={i} className="word-def__meaning">
              <span className="word-def__pos">{m.partOfSpeech}</span>
              {m.definitions.map((d, j) => (
                <div key={j}>
                  <p className="word-def__definition">{d.definition}</p>
                  {d.example && (
                    <p className="word-def__example">"{d.example}"</p>
                  )}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}

      <a
        className="word-def__link"
        href={`https://www.merriam-webster.com/dictionary/${word.toLowerCase()}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Full definition on Merriam-Webster ↗
      </a>
    </div>
  );
}
