import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRoom } from "../../lib/multiplayer/RoomContext";
import {
  formatClock,
  isEliminated,
  standings,
} from "../../lib/multiplayer/modes";
import {
  type BoardRow,
  type Outcome,
  type TileState,
} from "../../lib/multiplayer/types";
import { useNdleGame } from "../../components/game/useNdleGame";
import { NdleBoard } from "../../components/game/NdleBoard";
import { Keyboard } from "../../components/game/Keyboard";
import { NdleTile } from "../../components/tile/Tile";
import * as WordPicker from "../../lib/WordPicker";
import "./Multiplayer.css";

const HORSE = "HORSE";

function HorseMeter({
  letters = "",
  size = "md",
}: {
  letters?: string;
  size?: "sm" | "md";
}) {
  const count = letters.length;
  const eliminated = count >= 5;
  const danger = count === 4;

  return (
    <div
      className={`mp-horse-meter ${size} ${eliminated ? "eliminated" : danger ? "danger" : ""}`}
      aria-label={`HORSE: ${count} of 5`}
    >
      {HORSE.split("").map((ch, i) => {
        const earned = i < count;
        const state: TileState = eliminated
          ? "absent"
          : earned
            ? danger
              ? "present"
              : "correct"
            : "empty";
        return (
          <NdleTile
            key={i}
            letter={eliminated || earned ? ch : ""}
            state={state}
          />
        );
      })}
    </div>
  );
}

function LocalBoard({
  answer,
  onType,
  onSubmitRow,
  onFinish,
}: {
  answer: string;
  onType: (filled: number) => void;
  onSubmitRow: (pattern: TileState[]) => void;
  onFinish: (rows: BoardRow[], outcome: Outcome) => void;
}) {
  const game = useNdleGame({
    word: answer,
    dictionary: [answer],
    onType,
    onSubmitRow: (pattern) => onSubmitRow(pattern),
    onFinish: (rows, status) =>
      onFinish(rows, status === "won" ? "solved" : "failed"),
  });

  return (
    <div className="mp-local">
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
      <Keyboard
        guesses={game.guesses}
        onKey={game.handleKey}
        disabled={game.status !== "playing"}
      />
    </div>
  );
}

export function MultiplayerGame() {
  const { state, room } = useRoom();

  const doneOnce = useRef(false);
  // lazy initializer so Date.now() runs once, in the initializer, not on render
  const [now, setNow] = useState(() => Date.now());
  const lastTyping = useRef(0);

  const word = state?.word;
  const round = state?.round;
  const mode = state?.config.mode;
  const phase = state?.phase;

  useEffect(() => {
    doneOnce.current = false;
  }, [word, round]);

  useEffect(() => {
    if (mode !== "timeAttack" || phase !== "playing") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [mode, phase]);

  const selfId = state?.selfId;
  const selfPatternsLen =
    state?.players.find((p) => p.id === selfId)?.patterns.length ?? 0;

  // stable handler — its Date.now() runs on invocation, not during render
  const onType = useCallback(
    (filled: number) => {
      const t = Date.now();
      if (t - lastTyping.current > 120) {
        lastTyping.current = t;
        room?.sendTyping(selfPatternsLen, filled);
      }
    },
    [room, selfPatternsLen],
  );

  const handleFinish = useCallback(
    (rows: BoardRow[], outcome: Outcome) => {
      if (doneOnce.current) return;
      doneOnce.current = true;
      if (mode === "timeAttack") room?.sendTimeAttackWord(outcome === "solved");
      else room?.sendDone(rows, outcome);
    },
    [mode, room],
  );

  if (!state || !room) return null;

  const self = state.players.find((p) => p.id === state.selfId)!;
  // keep dropped players in the list so we can show a "left" cue rather than
  // having them silently vanish mid-game
  const others = state.players.filter((p) => p.id !== state.selfId);

  if (state.phase === "finished") return <Standings />;

  const isChallenger = mode === "horse" && state.challengerId === state.selfId;
  if (mode === "horse" && !state.word) {
    return isChallenger ? (
      <HorseLengthPicker onPick={(n) => room.pickHorseLength(n)} />
    ) : (
      <p className="mp-waiting">Waiting for the challenger to choose a word…</p>
    );
  }

  const boardWord = state.word ?? "";
  const remaining = (state.endsAt ?? 0) - now;
  const timeUp =
    mode === "timeAttack" && state.endsAt !== undefined && remaining <= 0;
  const selfEliminated = mode === "horse" && isEliminated(self);
  const oppCols = boardWord.length || 5;
  const oppCap = WordPicker.maxGuesses(oppCols);

  return (
    <div className="mp-game">
      <aside className="mp-hud">
        {mode === "timeAttack" && (
          <div className="mp-clock">{formatClock(remaining)}</div>
        )}
        {mode === "timeAttack" && (
          <div className="mp-score">score {self.taScore ?? 0}</div>
        )}
        {mode === "horse" && (
          <div className="mp-horse">
            <span className="mp-horse-label">
              {selfEliminated
                ? "You're out"
                : isChallenger
                  ? "You set the par"
                  : "Match the challenger"}
            </span>
            <HorseMeter letters={self.horseLetters} size="md" />
          </div>
        )}
      </aside>

      <main className="mp-play-area">
        {selfEliminated ? (
          <p className="mp-waiting">
            You spelled HORSE — you're out. Sit back and watch the rest play
            out.
          </p>
        ) : !timeUp ? (
          <LocalBoard
            key={`${boardWord}-${self.taSolved ?? 0}`}
            answer={boardWord}
            onType={onType}
            onSubmitRow={(pattern) =>
              room.sendProgress(self.patterns.length, pattern)
            }
            onFinish={handleFinish}
          />
        ) : (
          <p className="mp-waiting">Time! Waiting for everyone to wrap up…</p>
        )}
      </main>

      <section className="mp-opponents">
        {others.map((p) => {
          const oppOut = mode === "horse" && isEliminated(p);
          const dropped = !p.connected;
          // typingRow is derived host-side as patterns.length, so it always
          // points at the live row; just check they have letters down
          const typingActive = !dropped && (p.typingFilled ?? 0) > 0;
          return (
            <div
              className={`mp-opp ${oppOut ? "spectating" : ""} ${dropped ? "dropped" : ""}`}
              key={p.id}
            >
              <header>
                <span>{p.name}</span>
                {mode === "timeAttack" && !dropped && (
                  <span className="mp-score">{p.taScore ?? 0}</span>
                )}
                {dropped && <span className="mp-left-pill">left</span>}
                {!dropped && oppOut && <span className="mp-out-pill">out</span>}
                {!dropped && !oppOut && p.status === "done" && (
                  <span className="mp-done-pill">done</span>
                )}
              </header>
              {mode === "horse" && (
                <HorseMeter letters={p.horseLetters} size="sm" />
              )}
              {!oppOut && (
                <div className="mp-opp-board">
                  <NdleBoard
                    guesses={p.patterns.map((row) =>
                      row.map((s) => ({ letter: "", state: s })),
                    )}
                    wordLength={oppCols}
                    maxGuesses={oppCap}
                    hideLetters
                    typingRow={typingActive ? p.typingRow : undefined}
                    typingFilled={typingActive ? p.typingFilled : undefined}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function HorseLengthPicker({ onPick }: { onPick: (n: number) => void }) {
  const [len, setLen] = useState(5);
  return (
    <div className="mp-lobby">
      <h2 className="mp-title">Your turn to set the word</h2>
      <p className="mp-mode-line">
        Pick a length. You solve it first and your guess count is the par
        everyone else must match. Miss your own word and you take a letter.
      </p>
      <label className="mp-field">
        <span>Word length</span>
        <input
          type="number"
          min={2}
          max={11}
          value={len}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setLen(Number(e.target.value))
          }
        />
      </label>
      <button className="mp-primary" onClick={() => onPick(len)}>
        Deal the word
      </button>
    </div>
  );
}

function Standings() {
  const { state, room } = useRoom();
  const ranked = useMemo(() => (state ? standings(state) : []), [state]);
  if (!state) return null;
  const isHost = state.selfId === state.hostId;
  const mode = state.config.mode;

  if (mode === "horse" && !state.horseGameOver) {
    const challenger = state.players.find((p) => p.id === state.challengerId);
    const youPick = state.challengerId === state.selfId;
    const challengerSolved =
      state.reveal?.[state.challengerId ?? ""]?.outcome === "solved";
    return (
      <div className="mp-lobby">
        <h2 className="mp-title">Round {state.round} · result</h2>
        {state.word && (
          <p className="mp-answer">
            The word was <strong>{state.word}</strong>
            {challengerSolved
              ? " — par was set."
              : " — the challenger missed it."}
          </p>
        )}
        <ol className="mp-standings">
          {ranked.map((p) => (
            <li key={p.id} className={isEliminated(p) ? "out" : ""}>
              <span className="mp-roster-name">{p.name}</span>
              <HorseMeter letters={p.horseLetters} size="sm" />
            </li>
          ))}
        </ol>
        {youPick ? (
          <HorseLengthPicker onPick={(n) => room?.pickHorseLength(n)} />
        ) : (
          <p className="mp-waiting">
            Waiting for {challenger?.name ?? "the next player"} to pick the next
            word…
          </p>
        )}
      </div>
    );
  }

  if (mode === "horse" && state.horseGameOver) {
    const winner = state.players.find((p) => p.id === state.winnerId);
    return (
      <div className="mp-lobby">
        <h2 className="mp-title">
          {winner ? `${winner.name} wins!` : "Game over"}
        </h2>
        <ol className="mp-standings">
          {ranked.map((p) => (
            <li key={p.id} className={isEliminated(p) ? "out" : ""}>
              <span className="mp-roster-name">{p.name}</span>
              <HorseMeter letters={p.horseLetters} size="sm" />
            </li>
          ))}
        </ol>
        {isHost && (
          <button className="mp-primary" onClick={() => room?.startGame()}>
            New game
          </button>
        )}
      </div>
    );
  }

  const plainCap = state.word ? WordPicker.maxGuesses(state.word.length) : 0;
  return (
    <div className="mp-lobby">
      <h2 className="mp-title">Results</h2>
      <ol className="mp-standings">
        {ranked.map((p) => (
          <li key={p.id} className={isEliminated(p) ? "out" : ""}>
            <span className="mp-roster-name">{p.name}</span>
            <span className="mp-score">
              {mode === "timeAttack" &&
                `${p.taScore ?? 0} pts · ${p.taSolved ?? 0} solved`}
              {mode === "plain" &&
                (state.reveal?.[p.id]?.outcome === "solved"
                  ? `${state.reveal[p.id].rows.length}/${plainCap}`
                  : "X")}
            </span>
          </li>
        ))}
      </ol>

      {mode === "plain" && state.word && (
        <p className="mp-answer">
          The word was <strong>{state.word}</strong>
        </p>
      )}

      {isHost && (
        <button className="mp-primary" onClick={() => room?.startGame()}>
          Play again
        </button>
      )}
    </div>
  );
}
