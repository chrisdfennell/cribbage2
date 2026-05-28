export type Suit = "S" | "H" | "D" | "C";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "T"
  | "J"
  | "Q"
  | "K";

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ["S", "H", "D", "C"];
export const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
];

const RANK_ORDER: Record<Rank, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
};

const RANK_VALUE: Record<Rank, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 10,
  Q: 10,
  K: 10,
};

export function rankOrder(rank: Rank): number {
  return RANK_ORDER[rank];
}

export function cardValue(card: Card): number {
  return RANK_VALUE[card.rank];
}

export function cardId(rank: Rank, suit: Suit): string {
  return `${rank}${suit}`;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: cardId(rank, suit), rank, suit });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function cardLabel(card: Card): string {
  const rankLabel = card.rank === "T" ? "10" : card.rank;
  const suitSymbol = { S: "♠", H: "♥", D: "♦", C: "♣" }[card.suit];
  return `${rankLabel}${suitSymbol}`;
}

export function suitColor(suit: Suit): "red" | "black" {
  return suit === "H" || suit === "D" ? "red" : "black";
}
