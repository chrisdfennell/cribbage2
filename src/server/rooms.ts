/**
 * In-memory room registry. Lives on `globalThis` so that Next.js dev hot-reload
 * doesn't wipe rooms when modules reload. Single-instance only — multi-instance
 * deployment would need Redis / KV in place of this Map.
 */
import { nanoid } from "nanoid";
import {
  GameState,
  Player,
  advanceShow,
  advanceTurnIfStuck,
  beginPlay,
  discardToCrib,
  newGame,
  playCard,
  playableCards,
  startNewHand,
  teamCount,
} from "@/lib/cribbage/game";
import { aiPickDiscard, aiPickPlay } from "@/lib/cribbage/ai";
import { Card } from "@/lib/cribbage/cards";

type Color = "red" | "blue" | "green" | "yellow";

export interface LobbyPlayer {
  id: string;
  name: string;
  color: Color;
  kind: "human" | "ai";
  aiLevel?: "easy" | "medium" | "hard";
  /** Last time this player pinged. Used to garbage-collect disconnects. */
  lastSeen: number;
}

export interface Room {
  code: string;
  createdAt: number;
  hostId: string;
  partnership: boolean;
  /** "lobby" or "in-game" — once started, state is non-null. */
  phase: "lobby" | "in-game";
  lobbyPlayers: LobbyPlayer[];
  state: GameState | null;
  subscribers: Set<(snapshot: RoomSnapshot) => void>;
  /** Tracks pending AI work so we don't fire it twice */
  aiRunning: boolean;
}

export interface RoomSnapshot {
  code: string;
  hostId: string;
  partnership: boolean;
  phase: "lobby" | "in-game";
  lobbyPlayers: Omit<LobbyPlayer, "lastSeen">[];
  state: GameState | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __cribbageRooms: Map<string, Room> | undefined;
}

const rooms: Map<string, Room> =
  globalThis.__cribbageRooms ?? (globalThis.__cribbageRooms = new Map());

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ"; // skip I, L, O for legibility
const COLORS: Color[] = ["red", "blue", "green", "yellow"];

function generateCode(): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error("Could not allocate room code");
}

function pickAvailableColor(room: Room): Color {
  const used = new Set(room.lobbyPlayers.map((p) => p.color));
  for (const c of COLORS) {
    if (!used.has(c)) return c;
  }
  return COLORS[0];
}

function snapshot(room: Room): RoomSnapshot {
  return {
    code: room.code,
    hostId: room.hostId,
    partnership: room.partnership,
    phase: room.phase,
    lobbyPlayers: room.lobbyPlayers.map(({ lastSeen: _ls, ...p }) => p),
    state: room.state,
  };
}

function notify(room: Room) {
  const snap = snapshot(room);
  for (const fn of room.subscribers) {
    try {
      fn(snap);
    } catch (e) {
      console.error("subscriber threw:", e);
    }
  }
}

export function getSnapshot(code: string): RoomSnapshot | null {
  const r = rooms.get(code);
  return r ? snapshot(r) : null;
}

export function createRoom(hostName: string): {
  code: string;
  playerId: string;
} {
  const code = generateCode();
  const hostId = nanoid(10);
  const host: LobbyPlayer = {
    id: hostId,
    name: hostName || "Host",
    color: "red",
    kind: "human",
    lastSeen: Date.now(),
  };
  const room: Room = {
    code,
    createdAt: Date.now(),
    hostId,
    partnership: false,
    phase: "lobby",
    lobbyPlayers: [host],
    state: null,
    subscribers: new Set(),
    aiRunning: false,
  };
  rooms.set(code, room);
  return { code, playerId: hostId };
}

export function joinRoom(
  code: string,
  name: string,
): { playerId: string } | { error: string } {
  const room = rooms.get(code);
  if (!room) return { error: "Room not found" };
  if (room.phase !== "lobby") return { error: "Game already started" };
  if (room.lobbyPlayers.length >= 4) return { error: "Room is full" };
  const playerId = nanoid(10);
  room.lobbyPlayers.push({
    id: playerId,
    name: name || `Player ${room.lobbyPlayers.length + 1}`,
    color: pickAvailableColor(room),
    kind: "human",
    lastSeen: Date.now(),
  });
  notify(room);
  return { playerId };
}

export function subscribe(
  code: string,
  cb: (snap: RoomSnapshot) => void,
): { unsubscribe: () => void } | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.subscribers.add(cb);
  // immediately deliver current snapshot
  try {
    cb(snapshot(room));
  } catch (e) {
    console.error(e);
  }
  return {
    unsubscribe: () => {
      room.subscribers.delete(cb);
    },
  };
}

// =============================================================================
// Action handler
// =============================================================================

type Action =
  | { type: "add-ai"; level: "easy" | "medium" | "hard" }
  | { type: "remove-player"; playerId: string }
  | { type: "set-partnership"; partnership: boolean }
  | { type: "set-name"; name: string }
  | { type: "start-game" }
  | { type: "discard"; cardIds: string[] }
  | { type: "play-card"; cardId: string }
  | { type: "acknowledge-cut" }
  | { type: "advance-show-step" }
  | { type: "start-next-hand" };

export function applyAction(
  code: string,
  playerId: string,
  action: Action,
): { ok: true } | { error: string } {
  const room = rooms.get(code);
  if (!room) return { error: "Room not found" };
  const actor = room.lobbyPlayers.find((p) => p.id === playerId);
  if (!actor) return { error: "Player not in this room" };
  actor.lastSeen = Date.now();

  const isHost = playerId === room.hostId;

  switch (action.type) {
    case "add-ai": {
      if (!isHost) return { error: "Only host can add AI" };
      if (room.phase !== "lobby") return { error: "Already in game" };
      if (room.lobbyPlayers.length >= 4) return { error: "Room is full" };
      const aiNames = ["Claude", "Iris", "Rook", "Faye"];
      const used = new Set(room.lobbyPlayers.map((p) => p.name));
      const name =
        aiNames.find((n) => !used.has(n)) ??
        `AI ${room.lobbyPlayers.length + 1}`;
      room.lobbyPlayers.push({
        id: nanoid(10),
        name,
        color: pickAvailableColor(room),
        kind: "ai",
        aiLevel: action.level,
        lastSeen: Date.now(),
      });
      notify(room);
      return { ok: true };
    }
    case "remove-player": {
      if (!isHost) return { error: "Only host can remove" };
      if (room.phase !== "lobby") return { error: "Already in game" };
      if (action.playerId === room.hostId)
        return { error: "Cannot remove host" };
      room.lobbyPlayers = room.lobbyPlayers.filter(
        (p) => p.id !== action.playerId,
      );
      notify(room);
      return { ok: true };
    }
    case "set-partnership": {
      if (!isHost) return { error: "Only host" };
      if (room.phase !== "lobby") return { error: "Already in game" };
      room.partnership = action.partnership;
      notify(room);
      return { ok: true };
    }
    case "set-name": {
      actor.name = action.name || actor.name;
      notify(room);
      return { ok: true };
    }
    case "start-game": {
      if (!isHost) return { error: "Only host can start" };
      if (room.phase !== "lobby") return { error: "Already in game" };
      if (room.lobbyPlayers.length < 2)
        return { error: "Need at least 2 players" };
      const n = room.lobbyPlayers.length;
      const usePartnership = !!room.partnership && n === 4;
      const players: Player[] = room.lobbyPlayers.map((p, i) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        color: p.color,
        team: usePartnership ? i % 2 : i,
        ...(p.kind === "ai" ? { aiLevel: p.aiLevel ?? "medium" } : {}),
      }));
      let st = newGame(players);
      st = startNewHand(st);
      room.state = st;
      room.phase = "in-game";
      notify(room);
      // kick off AI work asynchronously
      scheduleAi(room);
      return { ok: true };
    }
    case "discard": {
      if (!room.state) return { error: "No game in progress" };
      const pIdx = room.lobbyPlayers.findIndex((p) => p.id === playerId);
      if (pIdx < 0) return { error: "Player not in game" };
      const hand = room.state.hands[pIdx];
      const cards = action.cardIds
        .map((id) => hand.find((c) => c.id === id))
        .filter((c): c is Card => !!c);
      try {
        room.state = discardToCrib(room.state, pIdx, cards);
      } catch (e) {
        return { error: String((e as Error).message || e) };
      }
      notify(room);
      scheduleAi(room);
      return { ok: true };
    }
    case "play-card": {
      if (!room.state) return { error: "No game in progress" };
      const pIdx = room.lobbyPlayers.findIndex((p) => p.id === playerId);
      if (pIdx < 0) return { error: "Player not in game" };
      if (room.state.turnIdx !== pIdx) return { error: "Not your turn" };
      const card = room.state.hands[pIdx].find((c) => c.id === action.cardId);
      if (!card) return { error: "Card not in hand" };
      try {
        let st = playCard(room.state, pIdx, card);
        st = advanceTurnIfStuck(st);
        room.state = st;
      } catch (e) {
        return { error: String((e as Error).message || e) };
      }
      notify(room);
      scheduleAi(room);
      return { ok: true };
    }
    case "acknowledge-cut": {
      if (!room.state) return { error: "No game in progress" };
      if (!isHost) return { error: "Only host can advance" };
      room.state = beginPlay(room.state);
      notify(room);
      scheduleAi(room);
      return { ok: true };
    }
    case "advance-show-step": {
      if (!room.state) return { error: "No game in progress" };
      if (!isHost) return { error: "Only host can advance" };
      const result = advanceShow(room.state);
      room.state = result.state;
      notify(room);
      return { ok: true };
    }
    case "start-next-hand": {
      if (!room.state) return { error: "No game in progress" };
      if (!isHost) return { error: "Only host can deal next" };
      if (room.state.phase !== "deal" && room.state.phase !== "show")
        return { error: "Cannot deal now" };
      room.state = startNewHand(room.state);
      notify(room);
      scheduleAi(room);
      return { ok: true };
    }
    default:
      return { error: "Unknown action" };
  }
}

// =============================================================================
// AI runner — drives AI players to act on their own
// =============================================================================

function scheduleAi(room: Room) {
  if (room.aiRunning) return;
  if (!room.state) return;
  room.aiRunning = true;
  setTimeout(() => {
    room.aiRunning = false;
    runAi(room);
  }, 450);
}

function runAi(room: Room) {
  let didWork = true;
  while (didWork) {
    didWork = false;
    const st = room.state;
    if (!st) return;

    if (st.phase === "discard") {
      const expected = st.players.length === 2 ? 2 : 1;
      const startSize = st.players.length === 2 ? 6 : 5;
      for (let i = 0; i < st.players.length; i++) {
        const p = st.players[i];
        if (p.kind !== "ai") continue;
        if (st.hands[i].length <= startSize - expected) continue;
        const discard = aiPickDiscard(
          st.hands[i],
          st.dealerIdx === i,
          p.aiLevel ?? "medium",
          expected,
        );
        try {
          room.state = discardToCrib(st, i, discard);
        } catch (e) {
          console.error("AI discard error:", e);
          return;
        }
        notify(room);
        didWork = true;
        break; // restart loop with fresh state
      }
    } else if (st.phase === "play") {
      const idx = st.turnIdx;
      const p = st.players[idx];
      if (p.kind !== "ai") {
        return; // wait for human
      }
      const opts = playableCards(st, idx);
      if (opts.length === 0) {
        room.state = advanceTurnIfStuck(st);
        notify(room);
        didWork = true;
        continue;
      }
      const card = aiPickPlay(st, idx, p.aiLevel ?? "medium");
      if (!card) {
        room.state = advanceTurnIfStuck(st);
        notify(room);
        didWork = true;
        continue;
      }
      try {
        let next = playCard(st, idx, card);
        next = advanceTurnIfStuck(next);
        room.state = next;
        notify(room);
        didWork = true;
      } catch (e) {
        console.error("AI play error:", e);
        return;
      }
    } else if (st.phase === "cut") {
      // Cut waits for host acknowledgment; AI doesn't auto-advance.
      return;
    } else {
      return;
    }
  }
}

// Periodic garbage collection: drop rooms idle for > 6 hours
setInterval(
  () => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [code, room] of rooms) {
      const lastActivity = Math.max(
        room.createdAt,
        ...room.lobbyPlayers.map((p) => p.lastSeen),
      );
      if (lastActivity < cutoff && room.subscribers.size === 0) {
        rooms.delete(code);
      }
    }
  },
  10 * 60 * 1000,
);

// Helper exports for the SSE route
export { rooms as __rooms_for_test };
export { teamCount };
