import Peer, { type DataConnection } from "peerjs";
import {
  type BoardRow,
  type ClientMsg,
  type GameConfig,
  type HostMsg,
  type Outcome,
  type PlayerInfo,
  type RoomState,
  type TileState,
} from "./types";

// ---------------------------------------------------------------------------
// Dependencies you wire to your existing ndle code. Keeping these as injected
// functions means RoomConnection has no opinion about how your dictionary is
// loaded — point getRandomWord at your .ndl loader.
// ---------------------------------------------------------------------------
export interface RoomDeps {
  getRandomWord: (length: number) => Promise<string> | string;
}

type Listener = (state: RoomState) => void;

const HORSE_LOSS = "HORSE";

/** Generate a short, human-friendly room code. PeerJS lets you set a custom
 *  peer id, and that id IS the code players type in. Avoid ambiguous chars. */
function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function emptyPlayer(id: string, name: string, isHost: boolean): PlayerInfo {
  return { id, name, connected: true, isHost, status: "idle", patterns: [] };
}

export class RoomConnection {
  private peer: Peer;
  private deps: RoomDeps;
  private listeners = new Set<Listener>();
  private state: RoomState;
  private readonly isHost: boolean;

  // host-only:
  private conns = new Map<string, DataConnection>(); // peerId -> connection
  private doneBuffer = new Map<
    string,
    { rows: BoardRow[]; outcome: Outcome }
  >();
  private lastSeen = new Map<string, number>(); // peerId -> last message epoch ms
  // guest-only:
  private hostConn: DataConnection | null = null;
  private keepalive?: ReturnType<typeof setInterval>;

  /** Resolves with the room code once the peer is registered with the broker. */
  readonly ready: Promise<string>;

  private constructor(opts: {
    isHost: boolean;
    peerId: string; // host: the room code; guest: undefined -> random
    code: string;
    name: string;
    config: GameConfig;
    deps: RoomDeps;
  }) {
    this.deps = opts.deps;
    this.isHost = opts.isHost;
    // For the host we pin the peer id to the room code so joiners can dial it
    // directly. For guests we let the broker assign a random id.
    this.peer = opts.isHost ? new Peer(opts.peerId) : new Peer();

    this.state = {
      code: opts.code,
      phase: "lobby",
      config: opts.config,
      selfId: opts.peerId, // overwritten for guests once peer opens
      hostId: opts.code, // host's peer id == room code
      players: [],
    };

    this.ready = new Promise<string>((resolve, reject) => {
      this.peer.on("open", (id: string) => {
        this.state = { ...this.state, selfId: id };
        if (this.isHost) {
          // host seats itself first
          this.state.players = [emptyPlayer(id, opts.name, true)];
          this.emit();
          this.setupHost();
        } else {
          this.setupGuest(opts.name);
        }
        resolve(opts.code);
      });
      this.peer.on("error", (err: Error) => {
        // 'peer-unavailable' here means the room code doesn't exist.
        reject(err);
      });
    });
  }

  static host(
    name: string,
    config: GameConfig,
    deps: RoomDeps,
  ): RoomConnection {
    const code = makeRoomCode();
    return new RoomConnection({
      isHost: true,
      peerId: code,
      code,
      name,
      config,
      deps,
    });
  }

  static join(code: string, name: string, deps: RoomDeps): RoomConnection {
    // config is a placeholder until the host's first lobby snapshot arrives.
    return new RoomConnection({
      isHost: false,
      peerId: "",
      code,
      name,
      config: { mode: "plain", wordLength: 5 },
      deps,
    });
  }

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  getState(): RoomState {
    return this.state;
  }

  private emit() {
    for (const fn of this.listeners) fn(this.state);
  }

  // =========================================================================
  // HOST
  // =========================================================================
  private setupHost() {
    this.peer.on("connection", (conn: DataConnection) => {
      conn.on("open", () => {
        this.conns.set(conn.peer, conn);
        this.lastSeen.set(conn.peer, Date.now());
        // The reliable drop signal: the underlying RTCPeerConnection's ICE
        // state. PeerJS's 'close' event and conn.open often DON'T update on an
        // ungraceful disconnect (closed tab, killed network), but ICE goes to
        // disconnected/failed within a few seconds.
        const pc = conn.peerConnection;
        if (pc) {
          pc.oniceconnectionstatechange = () => {
            const s = pc.iceConnectionState;
            if (s === "disconnected" || s === "failed" || s === "closed") {
              this.handleDrop(conn.peer);
            }
          };
        }
      });
      conn.on("data", (raw: unknown) => {
        this.lastSeen.set(conn.peer, Date.now());
        this.onHostData(conn, raw as ClientMsg);
      });
      conn.on("close", () => this.handleDrop(conn.peer));
      conn.on("error", () => this.handleDrop(conn.peer));
    });
    this.startHeartbeat();
  }

  private onHostData(conn: DataConnection, msg: ClientMsg) {
    switch (msg.t) {
      case "join": {
        // Seat the new player and push the full lobby to everyone.
        if (!this.state.players.some((p) => p.id === conn.peer)) {
          this.state = {
            ...this.state,
            players: [
              ...this.state.players,
              emptyPlayer(conn.peer, msg.name, false),
            ],
          };
        }
        this.broadcast({ t: "lobby", state: this.state });
        this.emit();
        break;
      }
      case "progress": {
        this.applyProgress(conn.peer, msg.row, msg.pattern);
        // relay the colours-only delta to the other clients
        this.relay(
          {
            t: "progress",
            playerId: conn.peer,
            row: msg.row,
            pattern: msg.pattern,
          },
          conn.peer,
        );
        this.emit();
        break;
      }
      case "typing": {
        this.applyTyping(conn.peer, msg.row, msg.filled);
        this.relay(
          {
            t: "typing",
            playerId: conn.peer,
            row: msg.row,
            filled: msg.filled,
          },
          conn.peer,
        );
        this.emit();
        break;
      }
      case "done": {
        this.recordDone(conn.peer, msg.rows, msg.outcome);
        break;
      }
      case "ta:word": {
        this.applyTimeAttackWord(conn.peer, msg.solved);
        const p = this.player(conn.peer);
        this.broadcast({
          t: "ta:score",
          playerId: conn.peer,
          taScore: p?.taScore ?? 0,
          taSolved: p?.taSolved ?? 0,
        });
        this.emit();
        break;
      }
      case "horse:pickLength": {
        void this.horseDealWord(msg.length);
        break;
      }
      case "ping": {
        // liveness only — lastSeen was already stamped in the data handler
        break;
      }
    }
  }

  /** Host starts the game (plain / timeAttack). Picks the shared word and pushes
   *  a full snapshot so every client adopts the same authoritative state. */
  async startGame() {
    if (!this.isHost) return;
    const cfg = this.state.config;
    this.doneBuffer.clear();

    if (cfg.mode === "horse") {
      // Fresh game. Round increments on each dealt word, so start at 0.
      // First challenger is the host; control then follows the solve/fail rule.
      this.state = {
        ...this.state,
        round: 0,
        challengerId: this.state.selfId,
        horseGameOver: false,
        winnerId: undefined,
        word: undefined,
        reveal: undefined,
        players: this.state.players.map((p) => ({
          ...p,
          status: "idle",
          patterns: [],
          horseLetters: "",
        })),
      };
      // Move to "playing" with no word yet; the challenger picks a length next.
      this.state.phase = "playing";
      this.broadcast({ t: "horse:round", state: this.state });
      this.emit();
      return;
    }

    const word = String(await this.deps.getRandomWord(cfg.wordLength));
    this.state = {
      ...this.state,
      phase: "playing",
      word,
      reveal: undefined,
      players: this.state.players.map((p) => ({
        ...p,
        status: "playing",
        patterns: [],
        outcome: undefined,
        taScore: cfg.mode === "timeAttack" ? 0 : undefined,
        taSolved: cfg.mode === "timeAttack" ? 0 : undefined,
      })),
      endsAt:
        cfg.mode === "timeAttack"
          ? Date.now() + cfg.durationSeconds * 1000
          : undefined,
    };
    this.broadcast({ t: "start", state: this.state });
    this.emit();

    if (cfg.mode === "timeAttack") {
      const ms = cfg.durationSeconds * 1000;
      setTimeout(() => this.endTimeAttack(), ms + 250); // small grace for in-flight msgs
    }
  }

  /** horse: deal a fresh word of the requested length to the whole room. This is
   *  the per-round entry point — it's called by the current challenger picking a
   *  length, whether that's round 1 or any subsequent round. */
  private async horseDealWord(length: number) {
    if (!this.isHost || this.state.horseGameOver) return;
    const word = String(await this.deps.getRandomWord(length));
    this.doneBuffer.clear();
    this.state = {
      ...this.state,
      phase: "playing",
      word,
      reveal: undefined,
      round: (this.state.round ?? 0) + 1,
      config: { mode: "horse" },
      players: this.state.players.map((p) => {
        const out = (p.horseLetters?.length ?? 0) >= 5;
        return {
          ...p,
          // Eliminated players are settled spectators for the round, not "playing".
          status: out ? "done" : "playing",
          patterns: [],
          outcome: undefined,
          typingRow: undefined,
          typingFilled: 0,
        };
      }),
    };
    this.broadcast({ t: "horse:round", state: this.state });
    this.emit();
  }

  private recordDone(playerId: string, rows: BoardRow[], outcome: Outcome) {
    this.doneBuffer.set(playerId, { rows, outcome });
    this.patchPlayer(playerId, { status: "done", outcome });
    this.emit();
    this.maybeReveal();
  }

  /** Fires once every *connected* player has reported done. Disconnected players
   *  are folded in as abandoned so a single drop can't wedge the room. */
  private maybeReveal() {
    if (
      this.state.phase !== "playing" ||
      this.state.config.mode === "timeAttack"
    )
      return;
    const horse = this.state.config.mode === "horse";
    const eliminated = (p: PlayerInfo) =>
      horse && (p.horseLetters?.length ?? 0) >= 5;
    // Eliminated players spectate — they aren't dealt a board, so don't wait on
    // them or the round would hang waiting for a "done" that never arrives.
    const active = this.state.players.filter(
      (p) => p.connected && !eliminated(p),
    );
    const everyoneDone = active.every((p) => this.doneBuffer.has(p.id));
    if (!everyoneDone) return;

    const reveal: NonNullable<RoomState["reveal"]> = {};
    for (const p of this.state.players) {
      if (eliminated(p)) continue; // spectators have no board this round
      const entry = this.doneBuffer.get(p.id);
      if (entry) {
        reveal[p.id] = entry;
      } else {
        // never reported (dropped): reconstruct blank rows from known patterns
        reveal[p.id] = {
          rows: p.patterns.map((row) =>
            row.map((s) => ({ letter: "", state: s })),
          ),
          outcome: "abandoned",
        };
      }
    }

    if (this.state.config.mode === "horse") {
      this.resolveHorseRound(reveal);
    }

    this.state = { ...this.state, phase: "finished", reveal };
    this.broadcast({ t: "reveal", state: this.state });
    this.emit();
  }

  /** Resolve one horse round, then set up the next.
   *
   *  Control rule (your house rules):
   *   - Challenger solves their own word  -> they set par; recipients who don't
   *     match par earn a letter; the challenger KEEPS control next round.
   *   - Challenger fails their own word    -> the CHALLENGER earns a letter;
   *     recipients are not penalised (no valid par); control passes to the next
   *     living player in seating order.
   *   - 5 letters spells HORSE = eliminated. Last player standing wins.
   */
  private resolveHorseRound(reveal: NonNullable<RoomState["reveal"]>) {
    const challengerId = this.state.challengerId ?? "";
    const challenger = reveal[challengerId];
    const challengerSolved = challenger?.outcome === "solved";
    const par = challengerSolved ? challenger!.rows.length : Infinity;

    const addLetter = (p: PlayerInfo): PlayerInfo => {
      const have = p.horseLetters ?? "";
      if (have.length >= 5) return p; // already out
      return { ...p, horseLetters: have + HORSE_LOSS[have.length] };
    };

    this.state = {
      ...this.state,
      players: this.state.players.map((p) => {
        if (p.id === challengerId) {
          return challengerSolved ? p : addLetter(p); // self-penalty on a missed pick
        }
        if (!challengerSolved) return p; // no contest for recipients this round
        const r = reveal[p.id];
        const matched = r && r.outcome === "solved" && r.rows.length <= par;
        return matched ? p : addLetter(p);
      }),
    };

    // Game over when at most one living, connected player remains.
    const living = this.state.players.filter(
      (p) => p.connected && (p.horseLetters?.length ?? 0) < 5,
    );
    if (living.length <= 1) {
      this.state = {
        ...this.state,
        horseGameOver: true,
        winnerId: living[0]?.id,
      };
      return;
    }

    // Control: solver keeps it; otherwise pass to the next living player. If the
    // staying challenger somehow isn't living (shouldn't happen — solving keeps
    // them alive), fall through to the next living player.
    let next = challengerSolved
      ? challengerId
      : this.nextChallenger(challengerId);
    if (!next || !living.some((p) => p.id === next))
      next = this.nextChallenger(challengerId);
    this.state = { ...this.state, challengerId: next };
  }

  /** Next living, connected player after `afterId` in seating (join) order. */
  private nextChallenger(afterId: string): string | undefined {
    const order = this.state.players;
    const n = order.length;
    const start = order.findIndex((p) => p.id === afterId);
    for (let step = 1; step <= n; step++) {
      const cand = order[(start + step) % n];
      if (cand.connected && (cand.horseLetters?.length ?? 0) < 5)
        return cand.id;
    }
    return undefined;
  }

  private endTimeAttack() {
    if (this.state.phase !== "playing") return;
    this.state = { ...this.state, phase: "finished" };
    this.broadcast({ t: "ta:end", state: this.state });
    this.emit();
  }

  // -------------------------------------------------------------------------
  // Presence / heartbeat
  // -------------------------------------------------------------------------
  private heartbeat?: ReturnType<typeof setInterval>;
  private startHeartbeat() {
    // Backstop for the ICE-state watcher: if we haven't heard from a peer in
    // ~9s (they ping every 3s), treat them as gone. Catches cases where even
    // ICE state doesn't transition promptly.
    this.heartbeat = setInterval(() => {
      const now = Date.now();
      for (const [id, conn] of this.conns) {
        const stale = now - (this.lastSeen.get(id) ?? now) > 9000;
        if (!conn.open || stale) this.handleDrop(id);
      }
    }, 3000);
  }

  private handleDrop(peerId: string) {
    if (!this.conns.has(peerId) && !this.player(peerId)) return;
    this.conns.delete(peerId);
    this.patchPlayer(peerId, { connected: false });
    this.broadcast({ t: "playerLeft", playerId: peerId });
    this.emit();
    // a drop might be the last "done" we were waiting on
    this.maybeReveal();
  }

  // -------------------------------------------------------------------------
  // Host send helpers
  // -------------------------------------------------------------------------
  private broadcast(msg: HostMsg) {
    for (const conn of this.conns.values()) if (conn.open) conn.send(msg);
  }
  private relay(msg: HostMsg, exceptPeerId: string) {
    for (const [id, conn] of this.conns)
      if (id !== exceptPeerId && conn.open) conn.send(msg);
  }

  // =========================================================================
  // GUEST
  // =========================================================================
  private setupGuest(name: string) {
    const conn = this.peer.connect(this.state.hostId, { reliable: true });
    this.hostConn = conn;
    conn.on("open", () => {
      conn.send({ t: "join", name } satisfies ClientMsg);
      // keepalive so the host can detect us going away even if ICE/close lag
      this.keepalive = setInterval(() => {
        if (conn.open) conn.send({ t: "ping" } satisfies ClientMsg);
      }, 3000);
    });
    conn.on("data", (raw: unknown) => this.onGuestData(raw as HostMsg));
    conn.on("close", () => {
      // host left -> room is gone
      this.state = { ...this.state, phase: "finished" };
      this.emit();
    });
  }

  private onGuestData(msg: HostMsg) {
    switch (msg.t) {
      case "lobby":
      case "start":
      case "reveal":
      case "horse:round":
      case "ta:end": {
        // adopt the authoritative snapshot, but preserve our own selfId
        const selfId = this.state.selfId;
        this.state = { ...msg.state, selfId };
        this.emit();
        break;
      }
      case "progress": {
        this.applyProgress(msg.playerId, msg.row, msg.pattern);
        this.emit();
        break;
      }
      case "typing": {
        this.applyTyping(msg.playerId, msg.row, msg.filled);
        this.emit();
        break;
      }
      case "playerLeft": {
        this.patchPlayer(msg.playerId, { connected: false });
        this.emit();
        break;
      }
      case "ta:score": {
        this.patchPlayer(msg.playerId, {
          taScore: msg.taScore,
          taSolved: msg.taSolved,
        });
        this.emit();
        break;
      }
    }
  }

  // =========================================================================
  // Public actions (used by the game UI, host and guest alike)
  // =========================================================================
  sendProgress(row: number, pattern: TileState[]) {
    if (this.isHost) {
      this.applyProgress(this.state.selfId, row, pattern);
      this.relay(
        { t: "progress", playerId: this.state.selfId, row, pattern },
        this.state.selfId,
      );
      this.emit();
    } else {
      this.send({ t: "progress", row, pattern });
    }
  }

  sendTyping(row: number, filled: number) {
    if (this.isHost) {
      this.applyTyping(this.state.selfId, row, filled);
      this.relay(
        { t: "typing", playerId: this.state.selfId, row, filled },
        this.state.selfId,
      );
      this.emit();
    } else {
      this.send({ t: "typing", row, filled });
    }
  }

  sendDone(rows: BoardRow[], outcome: Outcome) {
    if (this.isHost) this.recordDone(this.state.selfId, rows, outcome);
    else this.send({ t: "done", rows, outcome });
  }

  /** timeAttack: report that you finished one word. */
  sendTimeAttackWord(solved: boolean) {
    if (this.isHost) {
      this.applyTimeAttackWord(this.state.selfId, solved);
      const p = this.player(this.state.selfId);
      this.broadcast({
        t: "ta:score",
        playerId: this.state.selfId,
        taScore: p?.taScore ?? 0,
        taSolved: p?.taSolved ?? 0,
      });
      this.emit();
    } else {
      this.send({ t: "ta:word", solved });
    }
  }

  /** horse: the current challenger commits to a word length. */
  pickHorseLength(length: number) {
    if (this.isHost) void this.horseDealWord(length);
    else this.send({ t: "horse:pickLength", length });
  }

  private send(msg: ClientMsg) {
    if (this.hostConn?.open) this.hostConn.send(msg);
  }

  leave() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.keepalive) clearInterval(this.keepalive);
    for (const c of this.conns.values()) c.close();
    this.hostConn?.close();
    this.peer.destroy();
  }

  // =========================================================================
  // Reducer — pure-ish state mutations shared by host & guest. This is the
  // single "apply update to room state" path you asked about: the host's own
  // moves call it directly, network messages call it too, so there's no
  // special-casing of the host's board anywhere.
  // =========================================================================
  private player(id: string): PlayerInfo | undefined {
    return this.state.players.find((p) => p.id === id);
  }
  private patchPlayer(id: string, fields: Partial<PlayerInfo>) {
    this.state = {
      ...this.state,
      players: this.state.players.map((p) =>
        p.id === id ? { ...p, ...fields } : p,
      ),
    };
  }

  private applyProgress(id: string, row: number, pattern: TileState[]) {
    const p = this.player(id);
    if (!p) return;
    const patterns = [...p.patterns];
    patterns[row] = pattern;
    // submitting clears the in-progress row and moves the cursor to the next one
    this.patchPlayer(id, {
      patterns,
      status: "playing",
      typingRow: patterns.length,
      typingFilled: 0,
    });
  }

  private applyTyping(id: string, _row: number, filled: number) {
    const p = this.player(id);
    if (!p) return;
    // The row they're typing into is always the one after their submitted rows.
    // Deriving it here (rather than trusting the sent row) keeps it correct even
    // when the sender's optimistic row index lags the authoritative pattern count.
    this.patchPlayer(id, {
      typingRow: p.patterns.length,
      typingFilled: filled,
    });
  }

  private applyTimeAttackWord(id: string, solved: boolean) {
    const p = this.player(id);
    if (!p) return;
    // +1 solve, -1 fail; never below... well, it can go negative — that's the rule.
    const taScore = (p.taScore ?? 0) + (solved ? 1 : -1);
    const taSolved = (p.taSolved ?? 0) + (solved ? 1 : 0);
    this.patchPlayer(id, { taScore, taSolved, patterns: [] });
  }
}
