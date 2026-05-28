"use client";

import { create } from "zustand";
import type { RoomSnapshot } from "@/server/rooms";
import { RoomAction, sendAction } from "@/lib/roomClient";

interface OnlineStore {
  code: string | null;
  playerId: string | null;
  snapshot: RoomSnapshot | null;
  errorMsg: string | null;
  connected: boolean;
  // local UI state
  selectedDiscard: string[];
  // setters
  setSession: (code: string, playerId: string) => void;
  clearSession: () => void;
  setSnapshot: (snap: RoomSnapshot | null) => void;
  setError: (msg: string | null) => void;
  setConnected: (v: boolean) => void;
  toggleDiscard: (cardId: string) => void;
  clearDiscardSelection: () => void;
  // actions (proxied to server)
  send: (action: RoomAction) => Promise<void>;
}

export const useOnlineStore = create<OnlineStore>((set, get) => ({
  code: null,
  playerId: null,
  snapshot: null,
  errorMsg: null,
  connected: false,
  selectedDiscard: [],

  setSession: (code, playerId) => set({ code, playerId }),
  clearSession: () =>
    set({
      code: null,
      playerId: null,
      snapshot: null,
      connected: false,
      selectedDiscard: [],
      errorMsg: null,
    }),
  setSnapshot: (snap) => set({ snapshot: snap }),
  setError: (msg) => set({ errorMsg: msg }),
  setConnected: (v) => set({ connected: v }),
  toggleDiscard: (cardId) => {
    const sel = get().selectedDiscard;
    const snap = get().snapshot;
    const playerCount = snap?.state?.players.length ?? 2;
    const max = playerCount === 2 ? 2 : 1;
    if (sel.includes(cardId)) {
      set({ selectedDiscard: sel.filter((x) => x !== cardId) });
    } else {
      if (sel.length >= max) return;
      set({ selectedDiscard: [...sel, cardId] });
    }
  },
  clearDiscardSelection: () => set({ selectedDiscard: [] }),

  send: async (action) => {
    const { code, playerId } = get();
    if (!code || !playerId) {
      set({ errorMsg: "Not in a room" });
      return;
    }
    try {
      await sendAction(code, playerId, action);
      set({ errorMsg: null });
    } catch (e) {
      set({ errorMsg: (e as Error).message ?? String(e) });
    }
  },
}));
