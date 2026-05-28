"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RoomSnapshot } from "@/server/rooms";
import { RoomAction } from "@/lib/roomClient";
import { CribbageBoard, BoardTrack } from "./CribbageBoard";
import { Hand } from "./Hand";
import { PlayingCard } from "./PlayingCard";
import { RulesModal } from "./RulesModal";
import { LastHandRecap, LastHandRecapData } from "./LastHandRecap";
import { Card } from "@/lib/cribbage/cards";
import { ScoreItem } from "@/lib/cribbage/scoring";
import {
  GameState,
  playableCards,
  playerTeam,
  teamColor,
  teamCount,
  teamLabel,
} from "@/lib/cribbage/game";
import { sounds } from "@/lib/sound";

interface OnlineGameViewProps {
  snap: RoomSnapshot;
  meId: string;
  selectedDiscard: string[];
  toggleDiscard: (cardId: string) => void;
  clearDiscardSelection: () => void;
  send: (action: RoomAction) => void | Promise<void>;
  onLeave: () => void;
}

function pegColor(c: "red" | "blue" | "green" | "yellow"): string {
  return (
    {
      red: "#e94545",
      blue: "#3577e0",
      green: "#36a85a",
      yellow: "#e7b526",
    }[c] ?? "#999"
  );
}

function humanizeKind(kind: string): string {
  switch (kind) {
    case "fifteen":
      return "Fifteen";
    case "pair":
      return "Pair";
    case "run":
      return "Run";
    case "flush":
      return "Flush";
    case "nobs":
      return "Nobs";
    case "heels":
      return "His heels";
    case "pegging-15":
      return "Pegging 15";
    case "pegging-31":
      return "Pegging 31";
    case "pegging-pair":
      return "Pegging pair";
    case "pegging-run":
      return "Pegging run";
    case "pegging-go":
      return "Go";
    case "pegging-last":
      return "Last card";
    default:
      return kind;
  }
}

export function OnlineGameView({
  snap,
  meId,
  selectedDiscard,
  toggleDiscard,
  clearDiscardSelection,
  send,
  onLeave,
}: OnlineGameViewProps) {
  const state = snap.state!;
  const myIdx = state.players.findIndex((p) => p.id === meId);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // -------------------------------------------------------------------------
  // Derived: last show resolution + last hand recap from server-pushed state
  // -------------------------------------------------------------------------
  const lastShowResolution = useMemo(() => {
    if (state.phase !== "show") return null;
    const events = state.scoreEvents.filter(
      (e) => e.reason.startsWith("show:") || e.reason.startsWith("crib:"),
    );
    const last = events[events.length - 1];
    if (!last) return null;
    const pIdx = state.players.findIndex((p) => p.id === last.playerId);
    return {
      playerIdx: pIdx,
      isCrib: last.reason.startsWith("crib:"),
      total: last.points,
      items: last.items,
    };
  }, [state]);

  // last hand recap: track previous snapshot's hand fingerprint
  const recapRef = useRef<LastHandRecapData | null>(null);
  const prevHandSigRef = useRef<string>("");

  useEffect(() => {
    if (state.phase !== "show") return;
    // when all show events are present and the next snapshot may move to "deal",
    // we capture the recap. Simplest signal: when cribScored=true, snapshot the recap.
    if (!state.cribScored) return;
    const sig = state.scoreEvents
      .map((e) => `${e.playerId}:${e.points}:${e.reason}`)
      .join("|");
    if (sig === prevHandSigRef.current) return;
    prevHandSigRef.current = sig;

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
    const gainPerTeam = new Map<number, number>();
    for (const e of state.scoreEvents.slice(-30)) {
      const pIdx = state.players.findIndex((p) => p.id === e.playerId);
      if (pIdx < 0) continue;
      const t = playerTeam(state.players, pIdx);
      gainPerTeam.set(t, (gainPerTeam.get(t) ?? 0) + e.points);
    }
    recapRef.current = {
      dealerIdx: state.dealerIdx,
      starter: state.starter,
      handsByPlayer: state.initialHands.map((h, i) =>
        h.length === 4 ? h.slice() : state.played[i].slice(),
      ),
      crib: state.crib.slice(),
      scoresByTeam: state.scores.map((total, teamIdx) => ({
        teamIdx,
        gained: gainPerTeam.get(teamIdx) ?? 0,
        total,
      })),
      showEvents,
    };
  }, [state]);

  // -------------------------------------------------------------------------
  // Sound diff
  // -------------------------------------------------------------------------
  const prevPhase = useRef<string | null>(null);
  const prevPileLen = useRef<number>(0);
  const prevTotalScore = useRef<number[]>([]);
  const prevWinner = useRef<number | null>(null);
  useEffect(() => {
    if (!soundEnabled) {
      prevPhase.current = state.phase;
      prevPileLen.current = state.pile.length;
      prevTotalScore.current = state.scores.slice();
      prevWinner.current = state.winnerIdx;
      return;
    }
    if (state.pile.length > prevPileLen.current) sounds.cardPlay();
    for (let i = 0; i < state.scores.length; i++) {
      const before = prevTotalScore.current[i] ?? state.scores[i];
      const delta = state.scores[i] - before;
      if (delta > 0) sounds.pegMove(delta);
    }
    if (prevPhase.current !== state.phase) {
      if (state.phase === "cut") sounds.cut();
    }
    if (prevWinner.current === null && state.winnerIdx !== null) {
      sounds.win();
    }
    prevPhase.current = state.phase;
    prevPileLen.current = state.pile.length;
    prevTotalScore.current = state.scores.slice();
    prevWinner.current = state.winnerIdx;
  }, [state, soundEnabled]);

  // Build tracks
  const nTeams = teamCount(state.players);
  const activePlayerTeam =
    state.phase === "play"
      ? playerTeam(state.players, state.turnIdx)
      : -1;
  const tracks: BoardTrack[] = [];
  for (let t = 0; t < nTeams; t++) {
    tracks.push({
      id: `team-${t}`,
      label: teamLabel(state.players, t),
      color: teamColor(state.players, t),
      score: state.scores[t] ?? 0,
      prevScore: state.scores[t] ?? 0,
      active: t === activePlayerTeam,
    });
  }

  const isHost = meId === snap.hostId;
  const isMyTurn = state.phase === "play" && state.turnIdx === myIdx;
  const expected = state.players.length === 2 ? 2 : 1;
  const startSize = state.players.length === 2 ? 6 : 5;
  const needToDiscard =
    state.phase === "discard" &&
    myIdx >= 0 &&
    state.hands[myIdx].length > startSize - expected;

  return (
    <main className="min-h-screen p-3 md:p-6 flex flex-col gap-3 md:gap-4">
      <header className="flex items-center justify-between gap-2 md:gap-4 flex-wrap">
        <button
          onClick={onLeave}
          className="text-felt-50/70 hover:text-felt-50 text-sm whitespace-nowrap"
        >
          ← Leave
        </button>
        <div className="flex items-center gap-3 text-felt-50/90">
          <span className="text-xs uppercase tracking-widest text-felt-50/60">
            Phase
          </span>
          <span className="font-display text-lg text-amber-200">
            {phaseLabel(state.phase)}
          </span>
          <span className="text-xs text-felt-50/50 italic">
            dealer: {state.players[state.dealerIdx]?.name}
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 ml-auto flex-wrap">
          {tracks.map((t) => (
            <div
              key={t.id}
              className={`text-sm flex items-center gap-1.5 ${
                t.active ? "drop-shadow-[0_0_6px_rgba(255,200,80,0.7)]" : ""
              }`}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: pegColor(t.color) }}
              />
              <span className="text-felt-50/90 hidden sm:inline">
                {t.label}
              </span>
              <span className="font-bold text-amber-200 tabular-nums">
                {t.score}
              </span>
            </div>
          ))}
          <button
            onClick={() => setSoundEnabled((s) => !s)}
            aria-label={soundEnabled ? "Mute" : "Unmute"}
            className="text-felt-50/70 hover:text-felt-50 text-lg w-8 h-8 flex items-center justify-center rounded hover:bg-felt-700/50"
          >
            {soundEnabled ? "♪" : "🔇"}
          </button>
          <button
            onClick={() => setRulesOpen(true)}
            className="text-felt-50/70 hover:text-felt-50 text-sm border border-felt-600 px-2 py-1 rounded hover:bg-felt-700/50"
          >
            Rules
          </button>
        </div>
      </header>

      <div className="relative max-w-4xl mx-auto w-full">
        <CribbageBoard tracks={tracks} />
        <AnimatePresence>
          {state.pendingScorePops.map((sp, idx) => (
            <motion.div
              key={`${sp.playerId}-${sp.points}-${idx}`}
              initial={{ opacity: 0, y: 10, scale: 0.7 }}
              animate={{ opacity: 1, y: -40, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 pointer-events-none text-amber-300 font-display font-bold text-3xl text-shadow-sm"
            >
              +{sp.points} <span className="text-base">{sp.label}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <section className="flex flex-wrap justify-center items-start gap-3 sm:gap-6 mt-2">
        <div className="flex flex-col items-center gap-1">
          <div className="text-felt-50/70 text-sm font-display">Crib</div>
          <CribStack state={state} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-felt-50/70 text-sm font-display">Cut</div>
          <PlayingCard
            card={state.starter ?? undefined}
            faceDown={!state.starter || state.phase === "discard"}
            size="md"
          />
        </div>
        {state.phase === "play" && (
          <div className="flex flex-col items-center gap-1">
            <div className="text-felt-50/70 text-sm font-display">
              Count:{" "}
              <span className="text-amber-200 font-bold">
                {state.runningTotal}
              </span>
            </div>
            <div className="flex gap-1 min-h-[6rem]">
              {state.pile.length === 0 ? (
                <div className="text-felt-50/40 italic self-center px-4">
                  — pile reset —
                </div>
              ) : (
                state.pile.map((c) => (
                  <PlayingCard
                    key={c.id}
                    card={c}
                    size="sm"
                    layoutId={`play-${c.id}`}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-2 flex-1 flex flex-col items-center gap-3">
        {state.phase === "discard" && (
          <DiscardSection
            state={state}
            myIdx={myIdx}
            needToDiscard={needToDiscard}
            expected={expected}
            selectedDiscard={selectedDiscard}
            toggleDiscard={toggleDiscard}
            onConfirm={async () => {
              await send({ type: "discard", cardIds: selectedDiscard });
              clearDiscardSelection();
            }}
          />
        )}

        {state.phase === "cut" && (
          <CutSection
            state={state}
            canAdvance={isHost}
            onContinue={() => send({ type: "acknowledge-cut" })}
          />
        )}

        {state.phase === "play" && (
          <PlaySection
            state={state}
            myIdx={myIdx}
            isMyTurn={isMyTurn}
            onPlay={(c) => send({ type: "play-card", cardId: c.id })}
          />
        )}

        {state.phase === "show" && (
          <ShowSection
            state={state}
            lastResolution={lastShowResolution}
            isHost={isHost}
            onAdvance={() => send({ type: "advance-show-step" })}
            onNextHand={() => send({ type: "start-next-hand" })}
          />
        )}

        {state.phase === "deal" && (
          <div className="text-center">
            {isHost ? (
              <button
                onClick={() => send({ type: "start-next-hand" })}
                className="px-6 py-3 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
              >
                Deal Next Hand
              </button>
            ) : (
              <div className="text-felt-50/70 italic">
                Waiting for{" "}
                {state.players.find((p) => p.id === snap.hostId)?.name ??
                  "the host"}{" "}
                to deal...
              </div>
            )}
          </div>
        )}

        {state.phase === "gameOver" && (
          <div className="text-center p-8 bg-felt-800/70 border border-amber-300 rounded-2xl">
            <div className="text-3xl font-display text-amber-200 mb-2">
              🏆{" "}
              {state.winnerIdx !== null
                ? teamLabel(state.players, state.winnerIdx)
                : ""}{" "}
              wins!
            </div>
            <div className="text-felt-50/80 mb-4 tabular-nums">
              {tracks.map((t) => `${t.label}: ${t.score}`).join("  ·  ")}
            </div>
            <button
              className="px-6 py-3 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
              onClick={onLeave}
            >
              Back to Menu
            </button>
          </div>
        )}
      </section>

      {recapRef.current && (
        <details className="mt-2 max-w-3xl mx-auto w-full">
          <summary className="cursor-pointer text-felt-50/60 text-sm hover:text-felt-50">
            Last hand recap
          </summary>
          <div className="bg-felt-800/60 rounded p-3 mt-2">
            <LastHandRecap
              recap={recapRef.current}
              players={state.players}
              teamLabel={(t) => teamLabel(state.players, t)}
            />
          </div>
        </details>
      )}

      <details className="mt-2 max-w-3xl mx-auto w-full">
        <summary className="cursor-pointer text-felt-50/60 text-sm hover:text-felt-50">
          Game log ({state.log.length})
        </summary>
        <div className="bg-felt-800/60 rounded p-3 mt-2 max-h-48 overflow-y-auto text-sm text-felt-50/80 font-mono">
          {state.log.slice(-30).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </details>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </main>
  );
}

function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    deal: "Deal",
    discard: "Discard to crib",
    cut: "Cut starter",
    play: "Play (pegging)",
    show: "Show",
    gameOver: "Game over",
    lobby: "Lobby",
  };
  return labels[phase] ?? phase;
}

function CribStack({ state }: { state: GameState }) {
  const show = state.phase === "show" && state.cribScored;
  const count = state.crib.length;
  return (
    <div className="relative w-14 h-20 sm:w-16 sm:h-24">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="absolute"
          style={{ top: i * 3, left: i * 2 }}
        >
          <PlayingCard
            card={show ? state.crib[i] : undefined}
            faceDown={!show && i < count}
            size="md"
          />
        </div>
      ))}
      {count === 0 && (
        <div className="absolute inset-0 border-2 border-dashed border-felt-50/20 rounded-lg flex items-center justify-center text-felt-50/30 text-xs">
          crib
        </div>
      )}
    </div>
  );
}

function DiscardSection({
  state,
  myIdx,
  needToDiscard,
  expected,
  selectedDiscard,
  toggleDiscard,
  onConfirm,
}: {
  state: GameState;
  myIdx: number;
  needToDiscard: boolean;
  expected: number;
  selectedDiscard: string[];
  toggleDiscard: (id: string) => void;
  onConfirm: () => void;
}) {
  if (!needToDiscard) {
    const startSize = state.players.length === 2 ? 6 : 5;
    const waitingFor = state.players
      .filter((_, i) => state.hands[i].length > startSize - expected)
      .map((p) => p.name)
      .join(", ");
    return (
      <div className="text-center text-felt-50/70 italic">
        {waitingFor ? `Waiting for ${waitingFor}...` : "Waiting..."}
      </div>
    );
  }
  const me = state.players[myIdx];
  const myHand = state.hands[myIdx];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-felt-50/80 font-display">
        {me.name} — pick {expected} card{expected > 1 ? "s" : ""} to send to the{" "}
        {state.dealerIdx === myIdx
          ? "your"
          : `${state.players[state.dealerIdx].name}'s`}{" "}
        crib
      </div>
      <Hand
        cards={myHand}
        selected={selectedDiscard}
        onCardClick={(c) => toggleDiscard(c.id)}
      />
      <button
        disabled={selectedDiscard.length !== expected}
        onClick={onConfirm}
        className="px-5 py-2 rounded bg-amber-300 text-felt-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-200"
      >
        Send {selectedDiscard.length}/{expected} to crib
      </button>
    </div>
  );
}

function CutSection({
  state,
  canAdvance,
  onContinue,
}: {
  state: GameState;
  canAdvance: boolean;
  onContinue: () => void;
}) {
  const cut = state.starter;
  if (!cut) return null;
  const isHeels = cut.rank === "J";
  const dealer = state.players[state.dealerIdx];
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-felt-50/80 font-display">Starter card</div>
      <motion.div
        initial={{ rotateY: 180, scale: 0.8 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <PlayingCard card={cut} size="lg" />
      </motion.div>
      {isHeels && (
        <div className="text-amber-200 font-display text-lg">
          🎩 His heels! {dealer.name} scores 2
        </div>
      )}
      {canAdvance ? (
        <button
          onClick={onContinue}
          className="px-6 py-3 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
        >
          Begin Play
        </button>
      ) : (
        <div className="text-felt-50/60 italic text-sm">
          Waiting for host to begin play...
        </div>
      )}
    </div>
  );
}

function PlaySection({
  state,
  myIdx,
  isMyTurn,
  onPlay,
}: {
  state: GameState;
  myIdx: number;
  isMyTurn: boolean;
  onPlay: (c: Card) => void;
}) {
  const me = state.players[myIdx];
  const myHand = state.hands[myIdx] ?? [];
  const playable = isMyTurn
    ? playableCards(state, myIdx).map((c) => c.id)
    : [];
  const currentName = state.players[state.turnIdx]?.name ?? "...";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-felt-50/80 font-display">
        {isMyTurn ? (
          <>
            {me.name}, play a card{" "}
            <span className="text-felt-50/50">
              (count {state.runningTotal} → max {31 - state.runningTotal})
            </span>
          </>
        ) : (
          <span className="italic text-felt-50/60">
            {currentName} is playing...
          </span>
        )}
      </div>
      <Hand
        cards={myHand}
        playable={playable}
        onCardClick={(c) => onPlay(c)}
        layoutIdPrefix="play"
      />
      <div className="flex flex-wrap gap-6 justify-center mt-3">
        {state.players.map((p, i) =>
          i === myIdx ? null : (
            <div key={p.id} className="flex flex-col items-center">
              <div className="text-xs text-felt-50/60 mb-1">{p.name}</div>
              <Hand cards={state.hands[i]} faceDown size="sm" />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function ShowSection({
  state,
  lastResolution,
  isHost,
  onAdvance,
  onNextHand,
}: {
  state: GameState;
  lastResolution: {
    playerIdx: number;
    isCrib: boolean;
    total: number;
    items: ScoreItem[];
  } | null;
  isHost: boolean;
  onAdvance: () => void;
  onNextHand: () => void;
}) {
  const showOrderRemaining = state.showOrder.length - state.showIdx;
  const cribRemaining = !state.cribScored;
  const allDone = showOrderRemaining === 0 && !cribRemaining;

  let spotlightLabel = "";
  let spotlightCards: Card[] = [];
  if (lastResolution) {
    const p = state.players[lastResolution.playerIdx];
    spotlightLabel = lastResolution.isCrib
      ? `${p.name}'s crib`
      : `${p.name}'s hand`;
    spotlightCards = lastResolution.isCrib
      ? state.crib
      : state.hands[lastResolution.playerIdx];
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {lastResolution && (
        <div className="flex flex-col items-center gap-3 bg-felt-800/60 rounded-xl p-4 border border-felt-600 max-w-xl w-full">
          <div className="text-felt-50/80 font-display flex items-center gap-2">
            <span>{spotlightLabel}</span>
            <span className="text-amber-200 font-bold text-xl">
              +{lastResolution.total}
            </span>
          </div>
          <Hand cards={spotlightCards} size="md" />
          {state.starter && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-felt-50/60">cut</span>
              <PlayingCard card={state.starter} size="sm" />
            </div>
          )}
          {lastResolution.items.length === 0 ? (
            <div className="text-sm text-felt-50/60 italic">
              No points — a 19 hand!
            </div>
          ) : (
            <ul className="text-sm w-full max-w-sm space-y-1">
              {lastResolution.items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between bg-felt-900/40 rounded px-3 py-1"
                >
                  <span className="text-felt-50/85">
                    <span className="text-amber-100 capitalize mr-2">
                      {humanizeKind(it.kind)}
                    </span>
                    <span className="text-felt-50/65">{it.detail}</span>
                  </span>
                  <span className="text-amber-200 font-bold tabular-nums">
                    +{it.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!allDone && (
        <>
          {isHost ? (
            <button
              onClick={onAdvance}
              className="px-6 py-3 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
            >
              Score{" "}
              {cribRemaining && showOrderRemaining === 0
                ? "the crib"
                : `next (${showOrderRemaining + (cribRemaining ? 1 : 0)} left)`}
            </button>
          ) : (
            <div className="text-felt-50/60 italic text-sm">
              Waiting for host to advance...
            </div>
          )}
        </>
      )}

      {allDone &&
        (isHost ? (
          <button
            onClick={onNextHand}
            className="px-6 py-3 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
          >
            Deal Next Hand
          </button>
        ) : (
          <div className="text-felt-50/60 italic text-sm">
            Waiting for host to deal next hand...
          </div>
        ))}
    </div>
  );
}
