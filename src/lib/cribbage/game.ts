import { Card, cardValue, createDeck, shuffle } from "./cards";
import {
  ScoreItem,
  heelsBonus,
  scorePeggingPlay,
  scoreShow,
} from "./scoring";

export type Phase =
  | "lobby"
  | "deal"
  | "discard"
  | "cut"
  | "play"
  | "show"
  | "gameOver";

export type PlayerKind = "human" | "ai";

export interface Player {
  id: string;
  name: string;
  kind: PlayerKind;
  color: "red" | "blue" | "green" | "yellow";
  /** Team index. Defaults to player index (cutthroat); partnership shares teams. */
  team?: number;
  aiLevel?: "easy" | "medium" | "hard";
}

export function playerTeam(players: Player[], idx: number): number {
  return players[idx].team ?? idx;
}

export function teamCount(players: Player[]): number {
  let max = -1;
  for (let i = 0; i < players.length; i++) {
    const t = playerTeam(players, i);
    if (t > max) max = t;
  }
  return max + 1;
}

export function teamLabel(players: Player[], teamIdx: number): string {
  const members = players.filter((_, i) => playerTeam(players, i) === teamIdx);
  if (members.length === 1) return members[0].name;
  return members.map((p) => p.name).join(" & ");
}

export function teamColor(
  players: Player[],
  teamIdx: number,
): "red" | "blue" | "green" | "yellow" {
  for (let i = 0; i < players.length; i++) {
    if (playerTeam(players, i) === teamIdx) return players[i].color;
  }
  return "red";
}

export interface ScoreEvent {
  playerId: string;
  points: number;
  items: ScoreItem[];
  reason: string;
  ts: number;
}

export interface GameState {
  players: Player[];
  dealerIdx: number;
  phase: Phase;
  hands: Card[][]; // current hands (after discards in play phase)
  initialHands: Card[][]; // 4-card show hands, retained for the show phase
  crib: Card[];
  starter: Card | null;
  pile: Card[]; // current 31-count pile
  pileOwners: number[];
  runningTotal: number;
  turnIdx: number;
  lastToPlay: number;
  consecutiveGoes: number;
  played: Card[][]; // cards each player has played this hand
  scores: number[];
  showOrder: number[];
  showIdx: number;
  cribScored: boolean;
  log: string[];
  scoreEvents: ScoreEvent[];
  /** Winning *team* index (= player index in cutthroat modes). */
  winnerIdx: number | null;
  // pending pop-up score animations (consumed by UI)
  pendingScorePops: { playerId: string; points: number; label: string }[];
}

const TARGET_SCORE = 121;

export function newGame(players: Player[]): GameState {
  if (players.length < 2 || players.length > 4) {
    throw new Error("Cribbage supports 2-4 players");
  }
  const nTeams = teamCount(players);
  return {
    players,
    dealerIdx: 0,
    phase: "lobby",
    hands: players.map(() => []),
    initialHands: players.map(() => []),
    crib: [],
    starter: null,
    pile: [],
    pileOwners: [],
    runningTotal: 0,
    turnIdx: 1,
    lastToPlay: -1,
    consecutiveGoes: 0,
    played: players.map(() => []),
    scores: new Array(nTeams).fill(0),
    showOrder: [],
    showIdx: 0,
    cribScored: false,
    log: [],
    scoreEvents: [],
    winnerIdx: null,
    pendingScorePops: [],
  };
}

function clone(state: GameState): GameState {
  return {
    ...state,
    hands: state.hands.map((h) => h.slice()),
    initialHands: state.initialHands.map((h) => h.slice()),
    crib: state.crib.slice(),
    pile: state.pile.slice(),
    pileOwners: state.pileOwners.slice(),
    played: state.played.map((h) => h.slice()),
    scores: state.scores.slice(),
    showOrder: state.showOrder.slice(),
    log: state.log.slice(),
    scoreEvents: state.scoreEvents.slice(),
    pendingScorePops: state.pendingScorePops.slice(),
  };
}

function addLog(s: GameState, msg: string) {
  s.log = [...s.log, msg];
  if (s.log.length > 200) s.log = s.log.slice(-200);
}

function awardPoints(
  s: GameState,
  playerIdx: number,
  pts: number,
  items: ScoreItem[],
  reason: string,
) {
  if (pts <= 0) return;
  if (s.winnerIdx !== null) return;
  const teamIdx = playerTeam(s.players, playerIdx);
  s.scores[teamIdx] += pts;
  s.scoreEvents = [
    ...s.scoreEvents,
    {
      playerId: s.players[playerIdx].id,
      points: pts,
      items,
      reason,
      ts: Date.now() + Math.random(),
    },
  ];
  s.pendingScorePops = [
    ...s.pendingScorePops,
    { playerId: s.players[playerIdx].id, points: pts, label: reason },
  ];
  addLog(s, `${s.players[playerIdx].name} scored ${pts} (${reason}).`);
  if (s.scores[teamIdx] >= TARGET_SCORE) {
    s.winnerIdx = teamIdx;
    s.phase = "gameOver";
    addLog(s, `🏆 ${teamLabel(s.players, teamIdx)} wins the game!`);
  }
}

export function consumeScorePops(s: GameState): GameState {
  if (s.pendingScorePops.length === 0) return s;
  const next = clone(s);
  next.pendingScorePops = [];
  return next;
}

function handSizeForPlayers(n: number): number {
  return n === 2 ? 6 : 5;
}

export function startNewHand(state: GameState, rng = Math.random): GameState {
  const s = clone(state);
  const deck = shuffle(createDeck(), rng);
  const handSize = handSizeForPlayers(s.players.length);
  const hands: Card[][] = s.players.map(() => []);
  let pos = 0;
  for (let r = 0; r < handSize; r++) {
    for (let p = 0; p < s.players.length; p++) {
      hands[p].push(deck[pos++]);
    }
  }
  s.hands = hands;
  s.initialHands = hands.map(() => []);
  s.crib = [];
  // 3-player: deal 1 card directly to crib
  if (s.players.length === 3) {
    s.crib.push(deck[pos++]);
  }
  s.starter = deck[pos] ?? null;
  s.pile = [];
  s.pileOwners = [];
  s.runningTotal = 0;
  s.consecutiveGoes = 0;
  s.lastToPlay = -1;
  s.played = s.players.map(() => []);
  s.turnIdx = (s.dealerIdx + 1) % s.players.length;
  s.phase = "discard";
  s.showOrder = [];
  s.showIdx = 0;
  s.cribScored = false;
  addLog(
    s,
    `New hand dealt. ${s.players[s.dealerIdx].name} is the dealer.`,
  );
  return s;
}

/**
 * A player discards cards from their hand to the crib.
 * For 2p: each player discards 2.
 * For 3p / 4p: each player discards 1 (crib already has 1 in 3p case).
 */
export function discardToCrib(
  state: GameState,
  playerIdx: number,
  cards: Card[],
): GameState {
  if (state.phase !== "discard") return state;
  const s = clone(state);
  const expected = s.players.length === 2 ? 2 : 1;
  if (cards.length !== expected) {
    throw new Error(`Must discard exactly ${expected} card(s)`);
  }
  const hand = s.hands[playerIdx];
  for (const c of cards) {
    const idx = hand.findIndex((x) => x.id === c.id);
    if (idx < 0) throw new Error(`Player does not hold ${c.id}`);
    hand.splice(idx, 1);
  }
  s.crib = [...s.crib, ...cards];
  s.initialHands[playerIdx] = hand.slice();
  addLog(s, `${s.players[playerIdx].name} discarded to crib.`);

  // If all hands have been reduced to 4, move to cut phase (paused — user clicks
  // through after seeing the cut card and any "his heels" bonus).
  const allDiscarded = s.hands.every((h) => h.length === 4);
  if (allDiscarded) {
    s.phase = "cut";
    addLog(s, `Cut card: ${s.starter ? s.starter.rank + s.starter.suit : "?"}`);
    const heels = heelsBonus(s.starter);
    if (heels) {
      awardPoints(s, s.dealerIdx, heels.points, [heels], "his heels");
    }
  }
  return s;
}

/**
 * Acknowledge the cut card and begin pegging.
 */
export function beginPlay(state: GameState): GameState {
  if (state.phase !== "cut") return state;
  if (state.winnerIdx !== null) return state;
  const s = clone(state);
  s.phase = "play";
  s.turnIdx = (s.dealerIdx + 1) % s.players.length;
  s.runningTotal = 0;
  s.pile = [];
  s.pileOwners = [];
  s.consecutiveGoes = 0;
  s.lastToPlay = -1;
  return s;
}

export function playableCards(state: GameState, playerIdx: number): Card[] {
  if (state.phase !== "play") return [];
  return state.hands[playerIdx].filter(
    (c) => cardValue(c) + state.runningTotal <= 31,
  );
}

export function mustSayGo(state: GameState, playerIdx: number): boolean {
  if (state.phase !== "play") return false;
  return (
    state.hands[playerIdx].length > 0 &&
    playableCards(state, playerIdx).length === 0
  );
}

export function isPeggingDone(state: GameState): boolean {
  return state.hands.every((h) => h.length === 0);
}

export function playCard(
  state: GameState,
  playerIdx: number,
  card: Card,
): GameState {
  if (state.phase !== "play")
    throw new Error("Not in play phase");
  if (state.turnIdx !== playerIdx)
    throw new Error("Not this player's turn");
  if (cardValue(card) + state.runningTotal > 31)
    throw new Error("Card would exceed 31");
  const s = clone(state);
  const hand = s.hands[playerIdx];
  const idx = hand.findIndex((c) => c.id === card.id);
  if (idx < 0) throw new Error("Player does not hold that card");
  hand.splice(idx, 1);
  s.played[playerIdx] = [...s.played[playerIdx], card];
  s.pile = [...s.pile, card];
  s.pileOwners = [...s.pileOwners, playerIdx];
  s.runningTotal += cardValue(card);
  s.lastToPlay = playerIdx;
  s.consecutiveGoes = 0;
  addLog(
    s,
    `${s.players[playerIdx].name} played ${card.rank}${card.suit} (total ${s.runningTotal}).`,
  );

  // score pegging
  const peg = scorePeggingPlay(s.pile);
  if (peg.total > 0) {
    const reason = peg.items.map((i) => i.detail).join(", ");
    awardPoints(s, playerIdx, peg.total, peg.items, reason);
    if (s.winnerIdx !== null) return s;
  }

  // If 31 exactly: reset pile, next is the other player (after the one who played 31)
  if (s.runningTotal === 31) {
    s.pile = [];
    s.pileOwners = [];
    s.runningTotal = 0;
    s.consecutiveGoes = 0;
    s.turnIdx = (playerIdx + 1) % s.players.length;
    if (isPeggingDone(s)) return startShowPhase(s);
    return advanceTurnIfStuck(s);
  }

  // Move to next player who has cards
  s.turnIdx = nextActiveTurn(s, playerIdx);

  if (isPeggingDone(s)) return startShowPhase(s);
  return advanceTurnIfStuck(s);
}

function nextActiveTurn(s: GameState, from: number): number {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const j = (from + i) % n;
    if (s.hands[j].length > 0 || s.played[j].length > 0) return j;
  }
  return (from + 1) % n;
}

/**
 * Returns true if no remaining player can legally play in the current 31-count.
 */
function noOneCanPlay(s: GameState): boolean {
  for (let i = 0; i < s.players.length; i++) {
    if (
      s.hands[i].length > 0 &&
      s.hands[i].some((c) => cardValue(c) + s.runningTotal <= 31)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Called after a play or after a "go". Checks whether the round (31-count) should
 * close — if so, awards "go" point and resets the pile.
 */
export function advanceTurnIfStuck(state: GameState): GameState {
  let s = state;
  // If everyone is stuck and someone has played a card in this round, close it.
  while (true) {
    if (s.phase !== "play") return s;
    if (isPeggingDone(s)) return startShowPhase(s);

    if (noOneCanPlay(s)) {
      // award go to last to play (1 point) unless this round was just opened
      if (s.lastToPlay >= 0 && s.runningTotal > 0) {
        const lastItem: ScoreItem = {
          kind: "pegging-go",
          points: 1,
          detail: "go",
        };
        const next = clone(s);
        awardPoints(next, s.lastToPlay, 1, [lastItem], "go");
        next.pile = [];
        next.pileOwners = [];
        next.runningTotal = 0;
        next.consecutiveGoes = 0;
        next.turnIdx = nextActiveTurn(next, s.lastToPlay);
        s = next;
        if (s.winnerIdx !== null) return s;
        if (isPeggingDone(s)) return startShowPhase(s);
        continue;
      } else {
        // edge case: shouldn't happen; bail
        return s;
      }
    }

    // Current player has playable card → wait for input
    if (
      s.hands[s.turnIdx].some(
        (c) => cardValue(c) + s.runningTotal <= 31,
      )
    ) {
      return s;
    }

    // Current player has cards but cannot play → automatically say "go"
    const next = clone(s);
    addLog(next, `${next.players[next.turnIdx].name} says "go".`);
    next.consecutiveGoes++;
    next.turnIdx = nextActiveTurn(next, next.turnIdx);
    s = next;
  }
}

function startShowPhase(state: GameState): GameState {
  const s = clone(state);
  s.phase = "show";
  // order: starting from non-dealer (pone), going around, then crib
  const order: number[] = [];
  for (let i = 1; i <= s.players.length; i++) {
    order.push((s.dealerIdx + i) % s.players.length);
  }
  // dealer is the last entry in the rotation (we added dealerIdx+n which is dealerIdx)
  s.showOrder = order;
  s.showIdx = 0;
  s.cribScored = false;
  // restore initialHands so the show can score the 4-card hand
  for (let i = 0; i < s.players.length; i++) {
    if (s.initialHands[i].length === 4) {
      s.hands[i] = s.initialHands[i].slice();
    } else {
      s.hands[i] = s.played[i].slice();
    }
  }
  addLog(s, `Pegging complete. Showing hands...`);
  return s;
}

export interface ShowResolution {
  playerIdx: number;
  isCrib: boolean;
  total: number;
  items: ScoreItem[];
}

/**
 * Advance through the show phase, scoring the next player's hand (or the crib).
 * Returns the new state and the resolution that was just scored (null if done).
 */
export function advanceShow(state: GameState): {
  state: GameState;
  resolution: ShowResolution | null;
} {
  if (state.phase !== "show")
    return { state, resolution: null };

  const s = clone(state);

  if (s.showIdx < s.showOrder.length) {
    const playerIdx = s.showOrder[s.showIdx];
    const hand = s.hands[playerIdx];
    const score = scoreShow(hand, s.starter, false);
    awardPoints(
      s,
      playerIdx,
      score.total,
      score.items,
      `show: ${score.total}`,
    );
    s.showIdx++;
    return {
      state: s,
      resolution: {
        playerIdx,
        isCrib: false,
        total: score.total,
        items: score.items,
      },
    };
  }

  if (!s.cribScored) {
    s.cribScored = true;
    const cribScore = scoreShow(s.crib, s.starter, true);
    awardPoints(
      s,
      s.dealerIdx,
      cribScore.total,
      cribScore.items,
      `crib: ${cribScore.total}`,
    );
    return {
      state: s,
      resolution: {
        playerIdx: s.dealerIdx,
        isCrib: true,
        total: cribScore.total,
        items: cribScore.items,
      },
    };
  }

  // done. End hand, prep next.
  if (s.winnerIdx === null) {
    s.dealerIdx = (s.dealerIdx + 1) % s.players.length;
    s.phase = "deal";
  }
  return { state: s, resolution: null };
}
