import { describe, it, expect } from "vitest";
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
} from "./game";
import { aiPickDiscard, aiPickPlay } from "./ai";

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function makePlayers(n = 2, partnership = false): Player[] {
  const palette: Array<"red" | "blue" | "green" | "yellow"> = [
    "red",
    "blue",
    "green",
    "yellow",
  ];
  const names = ["Alice", "Bob", "Carol", "Dave"];
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: names[i],
    kind: "ai" as const,
    color: palette[i],
    team: partnership && n === 4 ? i % 2 : i,
    aiLevel: "medium" as const,
  }));
}

function runHand(state: GameState): GameState {
  let s = state;
  // discard phase
  expect(s.phase).toBe("discard");
  for (let p = 0; p < s.players.length; p++) {
    const discard = aiPickDiscard(
      s.hands[p],
      s.dealerIdx === p,
      "medium",
      s.players.length === 2 ? 2 : 1,
    );
    s = discardToCrib(s, p, discard);
  }
  expect(["cut", "gameOver"]).toContain(s.phase);
  if (s.phase === "gameOver") return s;
  s = beginPlay(s);
  expect(["play", "gameOver"]).toContain(s.phase);
  if (s.phase === "gameOver") return s;

  // play phase
  let safety = 0;
  while (s.phase === "play") {
    safety++;
    if (safety > 200) throw new Error("pegging didn't terminate");
    const idx = s.turnIdx;
    const playable = playableCards(s, idx);
    if (playable.length === 0) {
      s = advanceTurnIfStuck(s);
      continue;
    }
    const card = aiPickPlay(s, idx, "medium");
    if (!card) {
      s = advanceTurnIfStuck(s);
      continue;
    }
    s = playCard(s, idx, card);
    s = advanceTurnIfStuck(s);
  }
  expect(["show", "gameOver"]).toContain(s.phase);

  if (s.phase === "gameOver") return s;

  // show phase
  while (s.phase === "show") {
    const result = advanceShow(s);
    s = result.state;
    if (result.resolution === null && s.phase === "show") break;
  }
  expect(["deal", "gameOver"]).toContain(s.phase);
  return s;
}

describe("game flow", () => {
  it("plays a full hand without throwing", () => {
    const players = makePlayers();
    let state = newGame(players);
    state = startNewHand(state, seededRng(42));
    const final = runHand(state);
    // both players should have non-negative scores
    expect(final.scores.every((s) => s >= 0)).toBe(true);
    // total combined score should be reasonable for one hand (< 60)
    expect(final.scores[0] + final.scores[1]).toBeLessThan(60);
  });

  it("plays a full game without throwing", () => {
    const players = makePlayers();
    let state = newGame(players);
    let safety = 0;
    while (state.phase !== "gameOver") {
      safety++;
      if (safety > 50) throw new Error("game didn't terminate in 50 hands");
      state = startNewHand(state, seededRng(100 + safety));
      state = runHand(state);
    }
    expect(state.winnerIdx).not.toBeNull();
    expect(state.scores[state.winnerIdx!]).toBeGreaterThanOrEqual(121);
  });

  it("3-player game plays without throwing", () => {
    const players = makePlayers(3);
    let state = newGame(players);
    let safety = 0;
    while (state.phase !== "gameOver") {
      safety++;
      if (safety > 50) throw new Error("3p game didn't terminate");
      state = startNewHand(state, seededRng(200 + safety));
      state = runHand(state);
    }
    expect(state.winnerIdx).not.toBeNull();
    expect(state.scores.length).toBe(3);
    expect(state.scores[state.winnerIdx!]).toBeGreaterThanOrEqual(121);
  });

  it("4-player cutthroat plays without throwing", () => {
    const players = makePlayers(4);
    let state = newGame(players);
    let safety = 0;
    while (state.phase !== "gameOver") {
      safety++;
      if (safety > 50) throw new Error("4p cutthroat didn't terminate");
      state = startNewHand(state, seededRng(300 + safety));
      state = runHand(state);
    }
    expect(state.scores.length).toBe(4);
    expect(state.scores[state.winnerIdx!]).toBeGreaterThanOrEqual(121);
  });

  it("4-player partnership plays with 2 team scores", () => {
    const players = makePlayers(4, true);
    let state = newGame(players);
    expect(state.scores.length).toBe(2);
    let safety = 0;
    while (state.phase !== "gameOver") {
      safety++;
      if (safety > 50) throw new Error("4p partnership didn't terminate");
      state = startNewHand(state, seededRng(400 + safety));
      state = runHand(state);
    }
    expect(state.scores.length).toBe(2);
    // winner is a TEAM index (0 or 1)
    expect([0, 1]).toContain(state.winnerIdx);
    expect(state.scores[state.winnerIdx!]).toBeGreaterThanOrEqual(121);
  });

  it("each pegging count never exceeds 31", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const players = makePlayers();
      let state = newGame(players);
      state = startNewHand(state, seededRng(seed));
      // discard
      for (let p = 0; p < state.players.length; p++) {
        const discard = aiPickDiscard(
          state.hands[p],
          state.dealerIdx === p,
          "medium",
          state.players.length === 2 ? 2 : 1,
        );
        state = discardToCrib(state, p, discard);
      }
      state = beginPlay(state);
      // play and assert running total never > 31
      while (state.phase === "play") {
        expect(state.runningTotal).toBeLessThanOrEqual(31);
        const idx = state.turnIdx;
        const playable = playableCards(state, idx);
        if (playable.length === 0) {
          state = advanceTurnIfStuck(state);
          continue;
        }
        const card = aiPickPlay(state, idx, "medium");
        state = playCard(state, idx, card!);
        state = advanceTurnIfStuck(state);
      }
    }
  });
});
