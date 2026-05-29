import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { useRoom } from "../../lib/multiplayer/RoomContext";
import { MODES } from "../../lib/multiplayer/modes";
import { MultiplayerGame } from "./MultiplayerGame";
import { type PlayerInfo } from "../../lib/multiplayer/types";
import "./Multiplayer.css";

const POOF_MS = 650;

export function RoomView() {
  const { code = "" } = useParams();
  const { state, room, join } = useRoom();

  // Direct-link / refresh recovery: no live connection, so ask for a name and
  // join the code from the URL.
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  if (!state || !room) {
    return (
      <div className="mp-lobby">
        <h1 className="mp-title">Join room {code}</h1>
        <label className="mp-field">
          <span>Screen name</span>
          <input
            value={name}
            maxLength={16}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
          />
        </label>
        <button
          className="mp-primary"
          disabled={!name.trim() || joining}
          onClick={() => {
            setJoining(true);
            join(code, name.trim()).catch(() => setJoining(false));
          }}
        >
          {joining ? "Joining…" : "Join"}
        </button>
      </div>
    );
  }

  if (state.phase !== "lobby") {
    return <MultiplayerGame />;
  }

  return <WaitingRoom />;
}

function WaitingRoom() {
  const { state, room } = useRoom();
  const isHost = state!.selfId === state!.hostId;
  const meta = MODES.find((m) => m.id === state!.config.mode)!;

  // --- poof bookkeeping: keep a just-dropped player on screen long enough to
  // animate them away, then remove them from the roster. ---
  const [poofing, setPoofing] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState<Set<string>>(new Set());
  const prevConnected = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const now = state!.players;
    for (const p of now) {
      const was = prevConnected.current.get(p.id);
      if (was === true && p.connected === false && !gone.has(p.id)) {
        setPoofing((s) => new Set(s).add(p.id));
        setTimeout(() => {
          setPoofing((s) => {
            const n = new Set(s);
            n.delete(p.id);
            return n;
          });
          setGone((s) => new Set(s).add(p.id));
        }, POOF_MS);
      }
      prevConnected.current.set(p.id, p.connected);
    }
  }, [state, gone]);

  const visible = state!.players.filter(
    (p) => p.connected || poofing.has(p.id),
  );
  const connectedCount = state!.players.filter((p) => p.connected).length;

  return (
    <div className="mp-room">
      <header className="mp-room-head">
        <div>
          <h1 className="mp-title">Room {state!.code}</h1>
          <p className="mp-mode-line">
            {meta.label} · {connectedCount}{" "}
            {connectedCount === 1 ? "player" : "players"}
          </p>
        </div>
        <button
          className="mp-copy"
          onClick={() => navigator.clipboard?.writeText(state!.code)}
          title="Copy room code"
        >
          Copy code
        </button>
      </header>

      <ul className="mp-roster">
        {visible.map((p) => (
          <RosterRow
            key={p.id}
            player={p}
            poofing={poofing.has(p.id)}
            isSelf={p.id === state!.selfId}
          />
        ))}
      </ul>

      {isHost ? (
        <button
          className="mp-primary"
          disabled={connectedCount < 1}
          onClick={() => room!.startGame()}
        >
          Start game
        </button>
      ) : (
        <p className="mp-waiting">Waiting for the host to start…</p>
      )}
    </div>
  );
}

function RosterRow({
  player,
  poofing,
  isSelf,
}: {
  player: PlayerInfo;
  poofing: boolean;
  isSelf: boolean;
}) {
  return (
    <li className={`mp-roster-row ${poofing ? "poof" : ""}`}>
      <span className="mp-avatar" aria-hidden>
        {player.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="mp-roster-name">
        {player.name}
        {isSelf && <em> (you)</em>}
        {player.isHost && <span className="mp-host-tag">host</span>}
      </span>
      {poofing && <span className="mp-poof-puff" aria-hidden />}
    </li>
  );
}
