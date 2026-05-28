import { describe, it, expect } from "vitest";
import { Card, Rank, Suit, cardId } from "./cards";
import { heelsBonus, scorePeggingPlay, scoreShow } from "./scoring";

function c(rank: Rank, suit: Suit): Card {
  return { id: cardId(rank, suit), rank, suit };
}

describe("scoreShow — fifteens", () => {
  it("counts a single two-card fifteen", () => {
    // 5♠ + T♦ = 15. No other subset sums to 15.
    const hand = [c("5", "S"), c("T", "D"), c("3", "C"), c("9", "C")];
    const score = scoreShow(hand, null, false);
    expect(score.items.filter((i) => i.kind === "fifteen")).toHaveLength(1);
  });

  it("counts perfect 29 hand", () => {
    // J♠ 5♥ 5♦ 5♣ + cut 5♠ → 29 (the only 29 hand)
    const hand = [c("5", "H"), c("5", "D"), c("5", "C"), c("J", "S")];
    const cut = c("5", "S");
    const score = scoreShow(hand, cut, false);
    expect(score.total).toBe(29);
  });

  it("counts 28 hand (four 5s, no nobs)", () => {
    // 5♠ 5♥ 5♦ 5♣ + cut T = 28
    const hand = [c("5", "S"), c("5", "H"), c("5", "D"), c("5", "C")];
    const cut = c("T", "D");
    const score = scoreShow(hand, cut, false);
    expect(score.total).toBe(28);
  });
});

describe("scoreShow — pairs", () => {
  it("scores a single pair as 2", () => {
    const hand = [c("4", "S"), c("4", "H"), c("8", "D"), c("9", "C")];
    const score = scoreShow(hand, null, false);
    const pairs = score.items.filter((i) => i.kind === "pair");
    expect(pairs).toHaveLength(1);
    expect(pairs[0].points).toBe(2);
  });

  it("scores three of a kind as 6 (three pairs)", () => {
    const hand = [c("7", "S"), c("7", "H"), c("7", "D"), c("2", "C")];
    const score = scoreShow(hand, null, false);
    const pairs = score.items.filter((i) => i.kind === "pair");
    expect(pairs).toHaveLength(3);
  });

  it("scores four of a kind as 12 (six pairs)", () => {
    const hand = [c("9", "S"), c("9", "H"), c("9", "D"), c("9", "C")];
    const score = scoreShow(hand, null, false);
    const pairs = score.items.filter((i) => i.kind === "pair");
    expect(pairs).toHaveLength(6);
  });
});

describe("scoreShow — runs", () => {
  it("scores a 3-card run", () => {
    const hand = [c("4", "S"), c("5", "H"), c("6", "D"), c("Q", "C")];
    const score = scoreShow(hand, null, false);
    const runs = score.items.filter((i) => i.kind === "run");
    expect(runs).toHaveLength(1);
    expect(runs[0].points).toBe(3);
  });

  it("scores a 4-card run", () => {
    const hand = [c("4", "S"), c("5", "H"), c("6", "D"), c("7", "C")];
    const score = scoreShow(hand, null, false);
    const runs = score.items.filter((i) => i.kind === "run");
    expect(runs).toHaveLength(1);
    expect(runs[0].points).toBe(4);
  });

  it("scores a double-run-of-3 as two 3-runs", () => {
    // 4 4 5 6 → two runs of 3
    const hand = [c("4", "S"), c("4", "H"), c("5", "D"), c("6", "C")];
    const score = scoreShow(hand, null, false);
    const runs = score.items.filter((i) => i.kind === "run");
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.points === 3)).toBe(true);
  });

  it("scores a triple run as three 3-runs (9 points from runs)", () => {
    // 4 4 4 5 6 → three 3-runs
    const hand = [c("4", "S"), c("4", "H"), c("4", "D"), c("5", "C")];
    const cut = c("6", "C");
    const score = scoreShow(hand, cut, false);
    const runs = score.items.filter((i) => i.kind === "run");
    expect(runs).toHaveLength(3);
    expect(runs.every((r) => r.points === 3)).toBe(true);
  });

  it("scores a double-double run as four 3-runs", () => {
    // 4 4 5 5 6 → four 3-runs
    const hand = [c("4", "S"), c("4", "H"), c("5", "D"), c("5", "C")];
    const cut = c("6", "C");
    const score = scoreShow(hand, cut, false);
    const runs = score.items.filter((i) => i.kind === "run");
    expect(runs).toHaveLength(4);
  });

  it("does NOT wrap-around Q-K-A", () => {
    const hand = [c("Q", "S"), c("K", "H"), c("A", "D"), c("2", "C")];
    const score = scoreShow(hand, null, false);
    const runs = score.items.filter((i) => i.kind === "run");
    expect(runs).toHaveLength(0);
  });
});

describe("scoreShow — flush", () => {
  it("4-card flush in hand only (no cut match) = 4", () => {
    const hand = [c("2", "H"), c("4", "H"), c("7", "H"), c("9", "H")];
    const cut = c("K", "S");
    const score = scoreShow(hand, cut, false);
    const flush = score.items.find((i) => i.kind === "flush");
    expect(flush?.points).toBe(4);
  });

  it("5-card flush (hand + cut match) = 5", () => {
    const hand = [c("2", "H"), c("4", "H"), c("7", "H"), c("9", "H")];
    const cut = c("K", "H");
    const score = scoreShow(hand, cut, false);
    const flush = score.items.find((i) => i.kind === "flush");
    expect(flush?.points).toBe(5);
  });

  it("crib only counts 5-card flush", () => {
    const hand = [c("2", "H"), c("4", "H"), c("7", "H"), c("9", "H")];
    const cut = c("K", "S");
    const score = scoreShow(hand, cut, true);
    const flush = score.items.find((i) => i.kind === "flush");
    expect(flush).toBeUndefined();
  });

  it("crib with 5-card flush = 5", () => {
    const crib = [c("2", "H"), c("4", "H"), c("7", "H"), c("9", "H")];
    const cut = c("K", "H");
    const score = scoreShow(crib, cut, true);
    const flush = score.items.find((i) => i.kind === "flush");
    expect(flush?.points).toBe(5);
  });
});

describe("scoreShow — nobs / heels", () => {
  it("nobs: jack in hand matching cut suit", () => {
    const hand = [c("J", "H"), c("3", "S"), c("7", "D"), c("8", "C")];
    const cut = c("5", "H");
    const score = scoreShow(hand, cut, false);
    const nobs = score.items.find((i) => i.kind === "nobs");
    expect(nobs?.points).toBe(1);
  });

  it("no nobs if jack suit differs from cut", () => {
    const hand = [c("J", "C"), c("3", "S"), c("7", "D"), c("8", "C")];
    const cut = c("5", "H");
    const score = scoreShow(hand, cut, false);
    const nobs = score.items.find((i) => i.kind === "nobs");
    expect(nobs).toBeUndefined();
  });

  it("heels: cut card is a Jack", () => {
    const cut = c("J", "H");
    expect(heelsBonus(cut)?.points).toBe(2);
  });

  it("no heels when cut isn't a Jack", () => {
    const cut = c("Q", "H");
    expect(heelsBonus(cut)).toBeNull();
  });
});

describe("scorePeggingPlay", () => {
  it("scores reaching 15", () => {
    const pile = [c("8", "S"), c("7", "H")]; // 8+7=15
    const res = scorePeggingPlay(pile);
    expect(res.total).toBe(2);
    expect(res.items.find((i) => i.kind === "pegging-15")).toBeDefined();
  });

  it("scores reaching 31", () => {
    const pile = [c("T", "S"), c("T", "H"), c("T", "D"), c("A", "C")];
    const res = scorePeggingPlay(pile);
    // 31 + previous pair scoring (just 31 here, plus pair for the two 10s? Actually
    // pile pair scoring looks at trailing consecutive same ranks: last two are T,A
    // → no pair. Score: 31 only.
    expect(res.items.find((i) => i.kind === "pegging-31")?.points).toBe(2);
  });

  it("scores a pair", () => {
    const pile = [c("7", "S"), c("7", "H")];
    const res = scorePeggingPlay(pile);
    expect(res.items.find((i) => i.kind === "pegging-pair")?.points).toBe(2);
  });

  it("scores pair royal", () => {
    const pile = [c("4", "S"), c("4", "H"), c("4", "D")];
    const res = scorePeggingPlay(pile);
    expect(res.items.find((i) => i.kind === "pegging-pair")?.points).toBe(6);
  });

  it("scores a 3-run regardless of order", () => {
    // played 5, 7, 6 → last 3 cards = 5,7,6 → run of 3
    const pile = [c("5", "S"), c("7", "H"), c("6", "D")];
    const res = scorePeggingPlay(pile);
    expect(res.items.find((i) => i.kind === "pegging-run")?.points).toBe(3);
  });

  it("scores a 4-run", () => {
    const pile = [c("3", "S"), c("5", "H"), c("4", "D"), c("6", "C")];
    const res = scorePeggingPlay(pile);
    expect(res.items.find((i) => i.kind === "pegging-run")?.points).toBe(4);
  });

  it("does not score a run when a duplicate breaks the tail", () => {
    // 4,5,5,6 → trailing tail 5,5,6 not all distinct; 5,6 too short
    const pile = [c("4", "S"), c("5", "H"), c("5", "D"), c("6", "C")];
    const res = scorePeggingPlay(pile);
    expect(
      res.items.find((i) => i.kind === "pegging-run"),
    ).toBeUndefined();
  });
});
