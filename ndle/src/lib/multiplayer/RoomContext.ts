import { createContext, useContext } from "react";
import { type RoomConnection } from "./RoomConnection";
import { type GameConfig, type RoomState } from "./types";

export interface RoomContextValue {
  room: RoomConnection | null;
  state: RoomState | null;
  host: (name: string, config: GameConfig) => Promise<string>;
  join: (code: string, name: string) => Promise<string>;
  leave: () => void;
}

export const RoomContext = createContext<RoomContextValue | null>(null);

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx)
    throw new Error("useRoom must be used inside <MultiplayerProvider>");
  return ctx;
}
