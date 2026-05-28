import { Card, cardValue } from "./cards";
import { GameState, playableCards } from "./game";
import { scorePeggingPlay, scoreShow } from "./scoring";

/**
 * Pick which 2 cards to discard to the crib.
 * Strategy: evaluate every (hand, discard) split. Score the kept 4-card hand
 * (without cut) and adjust for whether the crib is ours (add expected crib value)
 * or the opponent's (subtract).
 */
export function aiPickDiscard(
  hand: Card[],
  isOwnCrib: boolean,
  level: "easy" | "medium" | "hard" = "medium",
  count = 2,
): Card[] {
  if (hand.length < count || count <= 0) return [];
  const combos: { keep: Card[]; discard: Card[]; score: number }[] = [];
  const n = hand.length;
  const combinations = chooseIndices(n, count);
  for (const idxs of combinations) {
    const discard = idxs.map((i) => hand[i]);
    const keep = hand.filter((_, idx) => !idxs.includes(idx));
    const baseShow = scoreShow(keep, null, false).total;
    const cribContribution = estimateCribValue(discard, isOwnCrib);
    combos.push({ keep, discard, score: baseShow + cribContribution });
  }
  combos.sort((a, b) => b.score - a.score);
  if (level === "easy") {
    const idx = Math.floor(Math.random() * Math.min(4, combos.length));
    return combos[idx].discard;
  }
  if (level === "medium") {
    const idx = Math.floor(Math.random() * Math.min(2, combos.length));
    return combos[idx].discard;
  }
  return combos[0].discard;
}

function chooseIndices(n: number, k: number): number[][] {
  const out: number[][] = [];
  const buf: number[] = [];
  function rec(start: number) {
    if (buf.length === k) {
      out.push(buf.slice());
      return;
    }
    for (let i = start; i < n; i++) {
      buf.push(i);
      rec(i + 1);
      buf.pop();
    }
  }
  rec(0);
  return out;
}

/**
 * Rough heuristic for the points the crib will produce from these 2 cards.
 * Positive number; negative if it's the opponent's crib.
 */
function estimateCribValue(discard: Card[], isOwnCrib: boolean): number {
  let v = 0;
  for (const c of discard) {
    if (c.rank === "5") v += 2.5;
  }
  if (discard.length >= 2) {
    const [a, b] = discard;
    if (a.rank === b.rank) v += 2;
    if (cardValue(a) + cardValue(b) === 15) v += 2;
    const va = cardValue(a);
    const vb = cardValue(b);
    if (Math.abs(va - vb) === 1) v += 1;
    if (Math.abs(va - vb) === 2) v += 0.5;
    if (a.suit === b.suit) v += 0.5;
  }
  return isOwnCrib ? v : -v * 0.8;
}

/**
 * Pick a card to play in the pegging phase. Considers immediate pegging points
 * for itself and what the opponent could score back.
 */
export function aiPickPlay(
  state: GameState,
  playerIdx: number,
  level: "easy" | "medium" | "hard" = "medium",
): Card | null {
  const options = playableCards(state, playerIdx);
  if (options.length === 0) return null;

  if (level === "easy") {
    return options[Math.floor(Math.random() * options.length)];
  }

  type Scored = { card: Card; score: number };
  const scored: Scored[] = options.map((card) => {
    const newPile = [...state.pile, card];
    const result = scorePeggingPlay(newPile);
    const newTotal = state.runningTotal + cardValue(card);

    let score = result.total;

    // avoid putting the count at 21 (opponent might reach 31)
    // avoid putting count between 16 and 20 right before opponent
    if (newTotal === 21) score -= 1;
    if (newTotal >= 22 && newTotal <= 30 && level === "hard") {
      // mild penalty unless it scored
      if (result.total === 0) score -= 0.5;
    }

    // safer to dump high cards when they don't help
    if (result.total === 0) {
      // small preference for keeping low cards for later runs
      score -= cardValue(card) * 0.05;
    }

    // hard: avoid leading a 5 (very dangerous — opponent's 10/face = 15-2)
    if (state.pile.length === 0 && card.rank === "5" && level === "hard") {
      score -= 1.5;
    }

    return { card, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (level === "medium") {
    // some randomness among top few
    const top = scored.filter((s) => s.score >= scored[0].score - 0.5);
    return top[Math.floor(Math.random() * top.length)].card;
  }
  return scored[0].card;
}
