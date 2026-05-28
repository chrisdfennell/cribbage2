import { Card, Rank, cardValue, rankOrder } from "./cards";

export interface ScoreItem {
  kind:
    | "fifteen"
    | "pair"
    | "run"
    | "flush"
    | "nobs"
    | "heels"
    | "pegging-15"
    | "pegging-31"
    | "pegging-pair"
    | "pegging-run"
    | "pegging-go"
    | "pegging-last";
  points: number;
  detail: string;
}

export interface ShowScore {
  total: number;
  items: ScoreItem[];
}

function countFifteens(cards: Card[]): ScoreItem[] {
  const items: ScoreItem[] = [];
  const n = cards.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    const picked: Card[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += cardValue(cards[i]);
        picked.push(cards[i]);
      }
    }
    if (picked.length >= 2 && sum === 15) {
      items.push({
        kind: "fifteen",
        points: 2,
        detail: picked.map((c) => c.rank).join("+"),
      });
    }
  }
  return items;
}

function countPairs(cards: Card[]): ScoreItem[] {
  const items: ScoreItem[] = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i].rank === cards[j].rank) {
        items.push({
          kind: "pair",
          points: 2,
          detail: `${cards[i].rank}${cards[i].suit} + ${cards[j].rank}${cards[j].suit}`,
        });
      }
    }
  }
  return items;
}

function countRuns(cards: Card[]): ScoreItem[] {
  if (cards.length < 3) return [];
  // group by rankOrder
  const groups = new Map<number, number>();
  for (const c of cards) {
    const k = rankOrder(c.rank);
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => a - b);

  const items: ScoreItem[] = [];
  let i = 0;
  while (i < sortedKeys.length) {
    let j = i;
    while (
      j + 1 < sortedKeys.length &&
      sortedKeys[j + 1] === sortedKeys[j] + 1
    ) {
      j++;
    }
    const runLen = j - i + 1;
    if (runLen >= 3) {
      let multiplier = 1;
      for (let k = i; k <= j; k++) {
        multiplier *= groups.get(sortedKeys[k])!;
      }
      // each unique run of length runLen scores runLen points
      for (let m = 0; m < multiplier; m++) {
        items.push({
          kind: "run",
          points: runLen,
          detail: `run of ${runLen}`,
        });
      }
    }
    i = j + 1;
  }
  return items;
}

function countFlush(
  hand: Card[],
  cut: Card | null,
  isCrib: boolean,
): ScoreItem[] {
  if (hand.length !== 4) return [];
  const suit = hand[0].suit;
  const allSame = hand.every((c) => c.suit === suit);
  if (!allSame) return [];
  if (cut && cut.suit === suit) {
    return [{ kind: "flush", points: 5, detail: "5-card flush" }];
  }
  if (isCrib) return []; // crib needs all 5
  return [{ kind: "flush", points: 4, detail: "4-card flush" }];
}

function countNobs(hand: Card[], cut: Card | null): ScoreItem[] {
  if (!cut) return [];
  const jack = hand.find((c) => c.rank === "J" && c.suit === cut.suit);
  if (jack) return [{ kind: "nobs", points: 1, detail: "Jack of cut suit" }];
  return [];
}

/**
 * Score a hand (or crib) at the "show" phase.
 * @param hand 4-card hand or crib
 * @param cut the starter / cut card (may be null for partial scoring)
 * @param isCrib true if scoring the dealer's crib (different flush rule)
 */
export function scoreShow(
  hand: Card[],
  cut: Card | null,
  isCrib = false,
): ShowScore {
  const all = cut ? [...hand, cut] : hand;
  const items: ScoreItem[] = [
    ...countFifteens(all),
    ...countPairs(all),
    ...countRuns(all),
    ...countFlush(hand, cut, isCrib),
    ...countNobs(hand, cut),
  ];
  const total = items.reduce((s, it) => s + it.points, 0);
  return { total, items };
}

/**
 * "His heels": dealer scores 2 if cut card is a Jack.
 */
export function heelsBonus(cut: Card | null): ScoreItem | null {
  if (cut && cut.rank === "J") {
    return { kind: "heels", points: 2, detail: "Jack cut (his heels)" };
  }
  return null;
}

// ============================================================================
// PEGGING
// ============================================================================

export interface PeggingResult {
  items: ScoreItem[];
  total: number;
}

/**
 * Score the card just played, given the current pile of played cards
 * (this turn's "count", reset after 31 or go-out).
 * @param pile the sequence of cards played in this 31-count, with the new card already appended
 */
export function scorePeggingPlay(pile: Card[]): PeggingResult {
  const items: ScoreItem[] = [];
  if (pile.length === 0) return { items, total: 0 };

  const runningTotal = pile.reduce((s, c) => s + cardValue(c), 0);

  if (runningTotal === 15) {
    items.push({ kind: "pegging-15", points: 2, detail: "fifteen" });
  }
  if (runningTotal === 31) {
    items.push({ kind: "pegging-31", points: 2, detail: "thirty-one" });
  }

  // pairs / triples / quads (count consecutive same-rank from end)
  const lastRank = pile[pile.length - 1].rank;
  let sameRank = 1;
  for (let i = pile.length - 2; i >= 0; i--) {
    if (pile[i].rank === lastRank) sameRank++;
    else break;
  }
  if (sameRank === 2) {
    items.push({ kind: "pegging-pair", points: 2, detail: "pair" });
  } else if (sameRank === 3) {
    items.push({ kind: "pegging-pair", points: 6, detail: "pair royal" });
  } else if (sameRank === 4) {
    items.push({
      kind: "pegging-pair",
      points: 12,
      detail: "double pair royal",
    });
  }

  // runs: scan back from end. Largest tail (length >= 3) that has all distinct
  // ranks forming a consecutive sequence (in any order) counts.
  let bestRun = 0;
  for (let len = pile.length; len >= 3; len--) {
    const tail = pile.slice(pile.length - len);
    const ranks = tail.map((c) => rankOrder(c.rank));
    const uniq = new Set(ranks);
    if (uniq.size !== ranks.length) continue;
    const sorted = [...ranks].sort((a, b) => a - b);
    let ok = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        ok = false;
        break;
      }
    }
    if (ok) {
      bestRun = len;
      break;
    }
  }
  if (bestRun >= 3) {
    items.push({
      kind: "pegging-run",
      points: bestRun,
      detail: `run of ${bestRun}`,
    });
  }

  const total = items.reduce((s, it) => s + it.points, 0);
  return { items, total };
}
