"use client";

import { create } from "zustand";
import { Card } from "@/lib/cribbage/cards";
import {
  GameState,
  Player,
  advanceShow,
  advanceTurnIfStuck,
  beginPlay,
  consumeScorePops,
  discardToCrib,
  newGame,
  playCard,
  playableCards,
  startNewHand,
} from "@/lib/cribbage/game";
import { ScoreItem } from "@/lib/cribbage/scoring";
import { aiPickDiscard, aiPickPlay } from "@/lib/cribbage/ai";

type Mode = "vs-ai" | "hotseat" | null;

interface GameStore {
  mode: Mode;
  state: GameState | null;
  prevScores: number[];
  selectedDiscard: string[];
  // ui flags
  aiThinking: boolean;
  soundEnabled: boolean;
  // hotseat: who should next look at the device (overlay shown when set)
  handoffTo: number | null;
  lastShowResolution: {
    playerIdx: number;
    isCrib: boolean;
    total: number;
    items: ScoreItem[];
  } | null;
  /**
   * Snapshot of the hand that just finished (for "last hand recap").
   * Captured at the moment we transition from show → deal.
   */
  lastHandRecap: {
    dealerIdx: number;
    starter: Card | null;
    handsByPlayer: Card[][];
    crib: Card[];
    scoresByTeam: { teamIdx: number; gained: number; total: number }[];
    showEvents: {
      playerIdx: number;
      isCrib: boolean;
      total: number;
      items: ScoreItem[];
    }[];
  } | null;
  // setup
  startVsAi: (opts: {
    playerName: string;
    aiLevel: "easy" | "medium" | "hard";
    numAi: 1 | 2 | 3;
    partnership?: boolean;
  }) => void;
  startHotseat: (opts: { names: string[]; partnership?: boolean }) => void;
  reset: () => void;
  // discard phase
  toggleDiscard: (cardId: string) => void;
  confirmDiscard: (playerIdx: number) => void;
  // cut phase
  acknowledgeCut: () => void;
  // play phase
  humanPlay: (card: Card) => void;
  // show / next deal
  advanceShowStep: () => void;
  startNextHand: () => void;
  // animation
  clearScorePops: () => void;
  // handoff
  acknowledgeHandoff: () => void;
  // sound
  toggleSound: () => void;
}

function snapPrev(state: GameState): number[] {
  return state.scores.slice();
}

export const useGameStore = create<GameStore>((set, get) => ({
  mode: null,
  state: null,
  prevScores: [],
  selectedDiscard: [],
  aiThinking: false,
  soundEnabled: true,
  handoffTo: null,
  lastShowResolution: null,
  lastHandRecap: null,

  startVsAi: ({ playerName, aiLevel, numAi, partnership }) => {
    const palette: Array<"red" | "blue" | "green" | "yellow"> = [
      "red",
      "blue",
      "green",
      "yellow",
    ];
    const aiNames = ["Claude", "Iris", "Rook"];
    const total = 1 + numAi;
    const usePartnership = !!partnership && total === 4;
    const players: Player[] = [];
    for (let i = 0; i < total; i++) {
      players.push({
        id: `p${i + 1}`,
        name: i === 0 ? playerName || "You" : aiNames[i - 1] ?? `AI ${i}`,
        kind: i === 0 ? "human" : "ai",
        color: palette[i],
        team: usePartnership ? i % 2 : i,
        ...(i === 0 ? {} : { aiLevel }),
      });
    }
    let state = newGame(players);
    state = startNewHand(state);
    set({
      mode: "vs-ai",
      state,
      prevScores: snapPrev(state),
      selectedDiscard: [],
      lastShowResolution: null,
      handoffTo: null,
    });
    queueMicrotask(() => maybeRunAi(set, get));
  },

  startHotseat: ({ names, partnership }) => {
    const palette: Array<"red" | "blue" | "green" | "yellow"> = [
      "red",
      "blue",
      "green",
      "yellow",
    ];
    const usePartnership = !!partnership && names.length === 4;
    const players: Player[] = names.map((rawName, i) => ({
      id: `p${i + 1}`,
      name: rawName || `Player ${i + 1}`,
      kind: "human" as const,
      color: palette[i],
      team: usePartnership ? i % 2 : i,
    }));
    let state = newGame(players);
    state = startNewHand(state);
    set({
      mode: "hotseat",
      state,
      prevScores: snapPrev(state),
      selectedDiscard: [],
      lastShowResolution: null,
      handoffTo: nextHumanToDiscard(state),
    });
  },

  reset: () => {
    set({
      mode: null,
      state: null,
      prevScores: [],
      selectedDiscard: [],
      lastShowResolution: null,
      lastHandRecap: null,
      handoffTo: null,
    });
  },

  toggleDiscard: (cardId) => {
    const sel = get().selectedDiscard;
    if (sel.includes(cardId)) {
      set({ selectedDiscard: sel.filter((x) => x !== cardId) });
    } else {
      const state = get().state;
      const max = state && state.players.length === 2 ? 2 : 1;
      if (sel.length >= max) return;
      set({ selectedDiscard: [...sel, cardId] });
    }
  },

  confirmDiscard: (playerIdx) => {
    const state = get().state;
    if (!state) return;
    const expected = state.players.length === 2 ? 2 : 1;
    const sel = get().selectedDiscard;
    if (sel.length !== expected) return;
    const hand = state.hands[playerIdx];
    const cards = sel
      .map((id) => hand.find((c) => c.id === id))
      .filter((c): c is Card => !!c);
    if (cards.length !== expected) return;
    const next = discardToCrib(state, playerIdx, cards);
    const mode = get().mode;
    // Determine if another human still needs to discard (hotseat handoff)
    let handoffTo: number | null = null;
    if (mode === "hotseat" && next.phase === "discard") {
      handoffTo = nextHumanToDiscard(next);
    }
    set({
      state: next,
      prevScores: state.scores.slice(),
      selectedDiscard: [],
      handoffTo,
    });
    queueMicrotask(() => maybeRunAi(set, get));
  },

  acknowledgeCut: () => {
    const state = get().state;
    if (!state || state.phase !== "cut") return;
    const next = beginPlay(state);
    const mode = get().mode;
    let handoffTo: number | null = null;
    if (
      mode === "hotseat" &&
      next.phase === "play" &&
      next.players[next.turnIdx].kind === "human"
    ) {
      handoffTo = next.turnIdx;
    }
    set({
      state: next,
      prevScores: state.scores.slice(),
      handoffTo,
    });
    queueMicrotask(() => maybeRunAi(set, get));
  },

  humanPlay: (card) => {
    const state = get().state;
    if (!state) return;
    if (state.phase !== "play") return;
    const idx = state.turnIdx;
    if (state.players[idx].kind !== "human") return;
    try {
      const next = playCard(state, idx, card);
      const advanced = advanceTurnIfStuck(next);
      // hotseat: if next-up is a different human, trigger handoff
      let handoffTo: number | null = null;
      const mode = get().mode;
      if (
        mode === "hotseat" &&
        advanced.phase === "play" &&
        advanced.players[advanced.turnIdx].kind === "human" &&
        advanced.turnIdx !== idx
      ) {
        handoffTo = advanced.turnIdx;
      }
      set({
        state: advanced,
        prevScores: state.scores.slice(),
        handoffTo,
      });
      queueMicrotask(() => maybeRunAi(set, get));
    } catch (e) {
      console.error(e);
    }
  },

  advanceShowStep: () => {
    const state = get().state;
    if (!state || state.phase !== "show") return;
    const result = advanceShow(state);
    set({
      state: result.state,
      prevScores: state.scores.slice(),
      lastShowResolution: result.resolution
        ? {
            playerIdx: result.resolution.playerIdx,
            isCrib: result.resolution.isCrib,
            total: result.resolution.total,
            items: result.resolution.items,
          }
        : null,
    });
  },

  startNextHand: () => {
    const state = get().state;
    if (!state) return;
    if (state.phase !== "deal" && state.phase !== "show") return;

    // capture recap of the just-finished hand before reshuffling
    const recap: GameStore["lastHandRecap"] = (() => {
      // recap requires we just finished the show phase
      if (state.phase !== "show" && state.phase !== "deal") return null;
      // gather show events from this hand: walk scoreEvents back to the most
      // recent "show" reason transitions
      const showEvents = state.scoreEvents
        .filter(
          (e) => e.reason.startsWith("show:") || e.reason.startsWith("crib:"),
        )
        .slice(-(state.players.length + 1))
        .map((e) => ({
          playerIdx: state.players.findIndex((p) => p.id === e.playerId),
          isCrib: e.reason.startsWith("crib:"),
          total: e.points,
          items: e.items,
        }));
      // hand-level point gain per team = state.scores - (snapshot at hand start)
      // we don't track that perfectly, so estimate from this hand's events:
      const gainPerTeam = new Map<number, number>();
      // find the most-recent "his heels" / pegging / show events for this hand
      // by walking back from the end until we hit a length cap.
      const recentEvents = state.scoreEvents.slice(
        -Math.max(20, state.players.length * 8),
      );
      for (const e of recentEvents) {
        const pIdx = state.players.findIndex((p) => p.id === e.playerId);
        if (pIdx < 0) continue;
        const t = state.players[pIdx].team ?? pIdx;
        gainPerTeam.set(t, (gainPerTeam.get(t) ?? 0) + e.points);
      }
      const scoresByTeam = state.scores.map((total, teamIdx) => ({
        teamIdx,
        gained: gainPerTeam.get(teamIdx) ?? 0,
        total,
      }));
      return {
        dealerIdx: state.dealerIdx,
        starter: state.starter,
        handsByPlayer: state.initialHands.map((h, i) =>
          h.length === 4 ? h.slice() : state.played[i].slice(),
        ),
        crib: state.crib.slice(),
        scoresByTeam,
        showEvents,
      };
    })();

    const next = startNewHand(state);
    const mode = get().mode;
    let handoffTo: number | null = null;
    if (mode === "hotseat") {
      handoffTo = nextHumanToDiscard(next);
    }
    set({
      state: next,
      prevScores: state.scores.slice(),
      selectedDiscard: [],
      lastShowResolution: null,
      lastHandRecap: recap,
      handoffTo,
    });
    queueMicrotask(() => maybeRunAi(set, get));
  },

  clearScorePops: () => {
    const state = get().state;
    if (!state) return;
    set({ state: consumeScorePops(state) });
  },

  acknowledgeHandoff: () => {
    set({ handoffTo: null });
  },

  toggleSound: () => {
    set({ soundEnabled: !get().soundEnabled });
  },
}));

function nextHumanToDiscard(state: GameState): number | null {
  if (state.phase !== "discard") return null;
  const expected = state.players.length === 2 ? 2 : 1;
  const startSize = state.players.length === 2 ? 6 : 5;
  for (let i = 0; i < state.players.length; i++) {
    if (
      state.players[i].kind === "human" &&
      state.hands[i].length > startSize - expected
    ) {
      return i;
    }
  }
  return null;
}

// -------------------------------------------------------------------
// AI runner
// -------------------------------------------------------------------

async function maybeRunAi(set: any, get: any) {
  if (get().aiThinking) return;
  const state: GameState | null = get().state;
  if (!state) return;

  // discard phase: any AI player who still needs to discard
  if (state.phase === "discard") {
    const expected = state.players.length === 2 ? 2 : 1;
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (p.kind !== "ai") continue;
      const handSize = state.hands[i].length;
      const startHandSize = state.players.length === 2 ? 6 : 5;
      if (handSize > startHandSize - expected) {
        // hasn't discarded yet
        set({ aiThinking: true });
        await sleep(450);
        const discard = aiPickDiscard(
          state.hands[i],
          state.dealerIdx === i,
          p.aiLevel ?? "medium",
          state.players.length === 2 ? 2 : 1,
        );
        const cur = get().state as GameState;
        const next = discardToCrib(cur, i, discard);
        set({
          state: next,
          prevScores: cur.scores.slice(),
          aiThinking: false,
        });
        return maybeRunAi(set, get);
      }
    }
    return;
  }

  if (state.phase === "play") {
    const idx = state.turnIdx;
    const p = state.players[idx];
    if (p.kind !== "ai") return;
    const playable = playableCards(state, idx);
    if (playable.length === 0) {
      // engine handles "go" automatically in advanceTurnIfStuck
      const advanced = advanceTurnIfStuck(state);
      set({ state: advanced, prevScores: state.scores.slice() });
      return maybeRunAi(set, get);
    }
    set({ aiThinking: true });
    await sleep(650);
    const card = aiPickPlay(state, idx, p.aiLevel ?? "medium");
    if (!card) {
      set({ aiThinking: false });
      return;
    }
    const cur = get().state as GameState;
    const next = playCard(cur, idx, card);
    const advanced = advanceTurnIfStuck(next);
    set({
      state: advanced,
      prevScores: cur.scores.slice(),
      aiThinking: false,
    });
    return maybeRunAi(set, get);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
