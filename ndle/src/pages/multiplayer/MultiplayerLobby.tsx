import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useRoom } from "../../lib/multiplayer/RoomContext";
import { MODES, buildConfig } from "../../lib/multiplayer/modes";
import { type GameModeId } from "../../lib/multiplayer/types";
import "./multiplayer.css";

export function MultiplayerLobby() {
  const nav = useNavigate();
  const { host, join } = useRoom();

  const [name, setName] = useState("");
  const [tab, setTab] = useState<"create" | "join">("create");
  const [mode, setMode] = useState<GameModeId>("plain");
  const [wordLength, setWordLength] = useState(5);
  const [minutes, setMinutes] = useState(5); // time attack base
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = MODES.find((m) => m.id === mode)!;
  const canSubmit =
    name.trim().length > 0 &&
    !busy &&
    (tab === "create" || code.trim().length >= 4);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const config = buildConfig(mode, {
        wordLength,
        durationSeconds: minutes * 60,
      });
      const roomCode = await host(name.trim(), config);
      nav(`/room/${roomCode}`);
    } catch {
      setError("Couldn't create the room. Try again.");
      setBusy(false);
    }
  }

  async function onJoin() {
    setBusy(true);
    setError(null);
    try {
      const roomCode = await join(code.trim(), name.trim());
      nav(`/room/${roomCode}`);
    } catch {
      setError("Couldn't find that room. Check the code.");
      setBusy(false);
    }
  }

  return (
    <div className="mp-lobby">
      <h1 className="mp-title">ndle · multiplayer</h1>

      <label className="mp-field">
        <span>Screen name</span>
        <input
          value={name}
          maxLength={16}
          placeholder="e.g. quokka"
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
        />
      </label>

      <div className="mp-tabs">
        <button
          className={tab === "create" ? "active" : ""}
          onClick={() => setTab("create")}
        >
          Host a room
        </button>
        <button
          className={tab === "join" ? "active" : ""}
          onClick={() => setTab("join")}
        >
          Join a room
        </button>
      </div>

      {tab === "create" ? (
        <div className="mp-panel">
          <div className="mp-modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`mp-mode-card ${mode === m.id ? "selected" : ""}`}
                onClick={() => setMode(m.id)}
              >
                <strong>{m.label}</strong>
                <span>{m.blurb}</span>
              </button>
            ))}
          </div>

          <div className="mp-options">
            {meta.hasFixedLength && (
              <label className="mp-field">
                <span>Word length</span>
                <input
                  type="number"
                  min={2}
                  max={11}
                  value={wordLength}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setWordLength(Number(e.target.value))
                  }
                />
              </label>
            )}
            {meta.hasTimer && (
              <label className="mp-field">
                <span>Time limit (minutes)</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={minutes}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setMinutes(Number(e.target.value))
                  }
                />
              </label>
            )}
          </div>

          <button
            className="mp-primary"
            disabled={!canSubmit}
            onClick={onCreate}
          >
            {busy ? "Creating…" : "Create room"}
          </button>
        </div>
      ) : (
        <div className="mp-panel">
          <label className="mp-field">
            <span>Room code</span>
            <input
              className="mp-code-input"
              value={code}
              maxLength={5}
              placeholder="ABCDE"
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setCode(e.target.value.toUpperCase())
              }
            />
          </label>
          <button className="mp-primary" disabled={!canSubmit} onClick={onJoin}>
            {busy ? "Joining…" : "Join room"}
          </button>
        </div>
      )}

      {error && <p className="mp-error">{error}</p>}
    </div>
  );
}
