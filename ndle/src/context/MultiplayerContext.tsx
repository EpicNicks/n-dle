import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  RoomConnection,
  type RoomDeps,
} from "../lib/multiplayer/RoomConnection";
import {
  RoomContext,
  type RoomContextValue,
} from "../lib/multiplayer/RoomContext";
import { type RoomState } from "../lib/multiplayer/types";
import * as WordPicker from "../lib/WordPicker";

// The room's word source is your real dictionary picker — the same module the
// solo game uses. getRandomWord may be sync or async.
const deps: RoomDeps = {
  getRandomWord: (length: number) => WordPicker.pickWord(length),
};

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const roomRef = useRef<RoomConnection | null>(null);
  const [state, setState] = useState<RoomState | null>(null);

  const attach = (room: RoomConnection) => {
    roomRef.current = room;
    room.subscribe(setState);
  };

  const value = useMemo<RoomContextValue>(
    () => ({
      get room() {
        return roomRef.current;
      },
      get state() {
        return state;
      },
      host: async (name, config) => {
        roomRef.current?.leave();
        const room = RoomConnection.host(name, config, deps);
        attach(room);
        return room.ready;
      },
      join: async (code, name) => {
        roomRef.current?.leave();
        const room = RoomConnection.join(code.toUpperCase(), name, deps);
        attach(room);
        return room.ready;
      },
      leave: () => {
        roomRef.current?.leave();
        roomRef.current = null;
        setState(null);
      },
    }),
    [state],
  );

  useEffect(() => () => roomRef.current?.leave(), []);

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
