import { type TileState } from "../../components/tile/Tile";
import { type LetterResult } from "../../components/tile/TileRow";

// ---------------------------------------------------------------------------
// Multiplayer uses the SAME tile vocabulary as the solo game. TileState and
// LetterResult come from the canonical tile components — no parallel copy.
//   - graded states: "correct" | "present" | "absent"
//   - in-progress placed-but-ungraded tile: "filled" (was "tbd" in the old draft)
//   - "empty": no tile
// BoardRow is just a row of LetterResult.
// ---------------------------------------------------------------------------
export type { TileState };
export type Tile = LetterResult;
export type BoardRow = LetterResult[];
export type Board = BoardRow[];

export type Outcome = "solved" | "failed" | "abandoned";

// ---------------------------------------------------------------------------
// Game modes
// ---------------------------------------------------------------------------
export type GameModeId = "plain" | "timeAttack" | "horse";

export type GameConfig =
  | { mode: "plain"; wordLength: number }
  | { mode: "timeAttack"; wordLength: number; durationSeconds: number }
  | { mode: "horse"; horseWord?: never };

export const DEFAULT_CONFIG: Record<GameModeId, GameConfig> = {
  plain: { mode: "plain", wordLength: 5 },
  timeAttack: { mode: "timeAttack", wordLength: 5, durationSeconds: 300 },
  horse: { mode: "horse" },
};

// ---------------------------------------------------------------------------
// Players & room state
// ---------------------------------------------------------------------------
export type RoomPhase = "lobby" | "playing" | "finished";

export interface PlayerInfo {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  status: "idle" | "playing" | "done";
  outcome?: Outcome;
  patterns: TileState[][];
  typingRow?: number;
  typingFilled?: number;
  taScore?: number;
  taSolved?: number;
  horseLetters?: string;
}

export interface RoomState {
  code: string;
  phase: RoomPhase;
  config: GameConfig;
  selfId: string;
  hostId: string;
  players: PlayerInfo[];
  word?: string;
  reveal?: Record<string, { rows: BoardRow[]; outcome: Outcome }>;
  challengerId?: string;
  round?: number;
  horseGameOver?: boolean;
  winnerId?: string;
  endsAt?: number;
}

// ---------------------------------------------------------------------------
// Wire protocol
// ---------------------------------------------------------------------------
export type ClientMsg =
  | { t: "join"; name: string }
  | { t: "progress"; row: number; pattern: TileState[] }
  | { t: "typing"; row: number; filled: number }
  | { t: "done"; rows: BoardRow[]; outcome: Outcome }
  | { t: "horse:pickLength"; length: number }
  | { t: "ta:word"; solved: boolean };

export type HostMsg =
  | { t: "lobby"; state: RoomState }
  | { t: "start"; state: RoomState }
  | { t: "progress"; playerId: string; row: number; pattern: TileState[] }
  | { t: "typing"; playerId: string; row: number; filled: number }
  | { t: "playerLeft"; playerId: string }
  | { t: "reveal"; state: RoomState }
  | { t: "horse:round"; state: RoomState }
  | { t: "ta:score"; playerId: string; taScore: number; taSolved: number }
  | { t: "ta:end"; state: RoomState };
