"use client";

/**
 * Browser-side client for the room API. Stores session (playerId + code) in
 * sessionStorage so a refresh keeps you in the same seat.
 */
import type { RoomSnapshot } from "@/server/rooms";

const SESSION_KEY = "cribbage_session_v1";

export interface Session {
  code: string;
  playerId: string;
}

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function writeSession(s: Session) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

export async function createRoomApi(name: string): Promise<Session> {
  const r = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(await safeError(r));
  const json = (await r.json()) as Session;
  writeSession(json);
  return json;
}

export async function joinRoomApi(
  code: string,
  name: string,
): Promise<Session> {
  const r = await fetch(`/api/rooms/${code.toUpperCase()}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(await safeError(r));
  const json = (await r.json()) as Session;
  writeSession(json);
  return json;
}

export type RoomAction =
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

export async function sendAction(
  code: string,
  playerId: string,
  action: RoomAction,
): Promise<void> {
  const r = await fetch(`/api/rooms/${code.toUpperCase()}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, action }),
  });
  if (!r.ok) throw new Error(await safeError(r));
}

async function safeError(r: Response): Promise<string> {
  try {
    const j = await r.json();
    return j.error ?? r.statusText;
  } catch {
    return r.statusText;
  }
}

/**
 * Subscribe to SSE for a room. Returns a cleanup function.
 */
export function subscribeToRoom(
  code: string,
  onSnapshot: (snap: RoomSnapshot) => void,
  onError?: (err: string) => void,
): () => void {
  const es = new EventSource(`/api/rooms/${code.toUpperCase()}/events`);
  es.onmessage = (e) => {
    try {
      const snap = JSON.parse(e.data) as RoomSnapshot;
      onSnapshot(snap);
    } catch (err) {
      onError?.(String(err));
    }
  };
  es.addEventListener("error", (e) => {
    // EventSource auto-reconnects; surface the error but don't close.
    const target = e as unknown as { data?: string };
    if (target.data) {
      try {
        const j = JSON.parse(target.data);
        if (j.error) onError?.(j.error);
      } catch {
        /* ignore */
      }
    }
  });
  return () => {
    es.close();
  };
}
