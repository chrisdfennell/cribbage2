"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { CribbageBoard } from "@/components/CribbageBoard";
import { Hand } from "@/components/Hand";
import { PlayingCard } from "@/components/PlayingCard";
import { HandoffOverlay } from "@/components/HandoffOverlay";
import { LastHandRecap } from "@/components/LastHandRecap";
import { RulesModal } from "@/components/RulesModal";
import {
  playableCards,
  playerTeam,
  teamColor,
  teamCount,
  teamLabel,
} from "@/lib/cribbage/game";
import type { GameState } from "@/lib/cribbage/game";
import type { BoardTrack } from "@/components/CribbageBoard";
import { Card } from "@/lib/cribbage/cards";
import { sounds } from "@/lib/sound";

export default function PlayPage() {
  const router = useRouter();
  const state = useGameStore((s) => s.state);
  const prevScores = useGameStore((s) => s.prevScores);
  const selectedDiscard = useGameStore((s) => s.selectedDiscard);
  const toggleDiscard = useGameStore((s) => s.toggleDiscard);
  const confirmDiscard = useGameStore((s) => s.confirmDiscard);
  const acknowledgeCut = useGameStore((s) => s.acknowledgeCut);
  const humanPlay = useGameStore((s) => s.humanPlay);
  const advanceShowStep = useGameStore((s) => s.advanceShowStep);
  const startNextHand = useGameStore((s) => s.startNextHand);
  const lastShowResolution = useGameStore((s) => s.lastShowResolution);
  const reset = useGameStore((s) => s.reset);
  const clearScorePops = useGameStore((s) => s.clearScorePops);
  const handoffTo = useGameStore((s) => s.handoffTo);
  const acknowledgeHandoff = useGameStore((s) => s.acknowledgeHandoff);
  const soundEnabled = useGameStore((s) => s.soundEnabled);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const lastHandRecap = useGameStore((s) => s.lastHandRecap);

  const [rulesOpen, setRulesOpen] = useState(false);

  // bounce back to home if no game in progress
  useEffect(() => {
    if (!state) router.replace("/");
  }, [state, router]);

  // auto-clear score pop animations after a moment
  useEffect(() => {
    if (state && state.pendingScorePops.length > 0) {
      const t = setTimeout(() => clearScorePops(), 900);
      return () => clearTimeout(t);
    }
  }, [state, clearScorePops]);

  // -------------------------------------------------------------------------
  // Sound effects driven by state diffs
  // -------------------------------------------------------------------------
  const prevPhase = useRef<string | null>(null);
  const prevPileLen = useRef<number>(0);
  const prevTotalScore = useRef<number[]>([]);
  const prevWinner = useRef<number | null>(null);

  useEffect(() => {
    if (!state || !soundEnabled) {
      if (state) {
        prevPhase.current = state.phase;
        prevPileLen.current = state.pile.length;
        prevTotalScore.current = state.scores.slice();
        prevWinner.current = state.winnerIdx;
      }
      return;
    }
    // card-play sound
    if (state.pile.length > prevPileLen.current) {
      sounds.cardPlay();
    }
    // score change → peg sound (per player, points delta)
    for (let i = 0; i < state.scores.length; i++) {
      const before = prevTotalScore.current[i] ?? state.scores[i];
      const delta = state.scores[i] - before;
      if (delta > 0) {
        sounds.pegMove(delta);
      }
    }
    // phase transitions
    if (prevPhase.current !== state.phase) {
      if (state.phase === "cut") sounds.cut();
      if (state.phase === "show") sounds.score(0);
    }
    // win
    if (prevWinner.current === null && state.winnerIdx !== null) {
      sounds.win();
    }
    prevPhase.current = state.phase;
    prevPileLen.current = state.pile.length;
    prevTotalScore.current = state.scores.slice();
    prevWinner.current = state.winnerIdx;
  }, [state, soundEnabled]);

  if (!state) return null;

  // identify the "active" human player. For vs-AI we always show p1's hand.
  // For hotseat with multiple humans, show whichever human's turn it is.
  const humanPlayers = state.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.kind === "human");

  const isHotseat = humanPlayers.length >= 2;

  const currentHumanIdx = (() => {
    if (!isHotseat) return humanPlayers[0]?.i ?? 0;
    if (state.phase === "discard") {
      const startSize = state.players.length === 2 ? 6 : 5;
      const expected = state.players.length === 2 ? 2 : 1;
      for (const { i } of humanPlayers) {
        if (state.hands[i].length > startSize - expected) return i;
      }
      return humanPlayers[0].i;
    }
    if (state.phase === "play") return state.turnIdx;
    return humanPlayers[0].i;
  })();

  // Build board tracks from teams
  const nTeams = teamCount(state.players);
  const activePlayerTeam =
    state.phase === "play" ? playerTeam(state.players, state.turnIdx) : -1;
  const tracks: BoardTrack[] = [];
  for (let t = 0; t < nTeams; t++) {
    tracks.push({
      id: `team-${t}`,
      label: teamLabel(state.players, t),
      color: teamColor(state.players, t),
      score: state.scores[t] ?? 0,
      prevScore: prevScores[t] ?? state.scores[t] ?? 0,
      active: t === activePlayerTeam,
    });
  }

  // Hide hands behind handoff overlay
  const shouldHideForHandoff = handoffTo !== null;

  return (
    <main className="min-h-screen p-3 md:p-6 flex flex-col gap-3 md:gap-4">
      <header className="flex items-center justify-between gap-2 md:gap-4 flex-wrap">
        <button
          onClick={() => {
            reset();
            router.replace("/");
          }}
          className="text-felt-50/70 hover:text-felt-50 text-sm whitespace-nowrap"
        >
          ← Menu
        </button>
        <PhaseIndicator
          phase={state.phase}
          dealerName={state.players[state.dealerIdx].name}
        />
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
            onClick={toggleSound}
            aria-label={soundEnabled ? "Mute" : "Unmute"}
            title={soundEnabled ? "Mute sounds" : "Enable sounds"}
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

      {/* Board */}
      <div className="relative">
        <CribbageBoard tracks={tracks} />
        {/* floating score pops */}
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

      {/* Play area: crib, cut, pile */}
      <section className="flex flex-wrap justify-center items-start gap-3 sm:gap-6 mt-2">
        <div className="flex flex-col items-center gap-1">
          <div className="text-felt-50/70 text-sm font-display">Crib</div>
          <CribStack count={state.crib.length} isDealer={state.dealerIdx} state={state} />
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
              Count: <span className="text-amber-200 font-bold">{state.runningTotal}</span>
            </div>
            <div className="flex gap-1 min-h-[6rem]">
              {state.pile.length === 0 ? (
                <div className="text-felt-50/40 italic self-center px-4">— pile reset —</div>
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

      {/* Phase-specific bottom region */}
      <section className="mt-2 flex-1 flex flex-col items-center gap-3">
        {state.phase === "discard" && !shouldHideForHandoff && (
          <DiscardPanel
            state={state}
            currentHumanIdx={currentHumanIdx}
            selectedDiscard={selectedDiscard}
            toggleDiscard={toggleDiscard}
            confirmDiscard={confirmDiscard}
          />
        )}

        {state.phase === "cut" && (
          <CutPanel state={state} onContinue={() => acknowledgeCut()} />
        )}

        {state.phase === "play" && !shouldHideForHandoff && (
          <PlayPanel
            state={state}
            currentHumanIdx={currentHumanIdx}
            humanPlay={humanPlay}
          />
        )}

        {state.phase === "show" && (
          <ShowPanel
            state={state}
            lastResolution={lastShowResolution}
            onNext={() => advanceShowStep()}
            onNewHand={() => startNextHand()}
          />
        )}

        {state.phase === "deal" && (
          <div className="text-center">
            <button
              className="px-6 py-3 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
              onClick={() => startNextHand()}
            >
              Deal Next Hand
            </button>
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
              onClick={() => {
                reset();
                router.replace("/");
              }}
            >
              Back to Menu
            </button>
          </div>
        )}
      </section>

      {/* Last hand recap */}
      {lastHandRecap && (
        <details className="mt-2 max-w-3xl mx-auto w-full">
          <summary className="cursor-pointer text-felt-50/60 text-sm hover:text-felt-50">
            Last hand recap
          </summary>
          <div className="bg-felt-800/60 rounded p-3 mt-2">
            <LastHandRecap
              recap={lastHandRecap}
              players={state.players}
              teamLabel={(t) => teamLabel(state.players, t)}
            />
          </div>
        </details>
      )}

      {/* Log */}
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

      {/* Handoff overlay */}
      <AnimatePresence>
        {handoffTo !== null && state.players[handoffTo] && (
          <HandoffOverlay
            player={state.players[handoffTo]}
            onReady={acknowledgeHandoff}
          />
        )}
      </AnimatePresence>

      {/* Rules modal */}
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </main>
  );
}

function PhaseIndicator({ phase, dealerName }: { phase: string; dealerName: string }) {
  const labels: Record<string, string> = {
    deal: "Deal",
    discard: "Discard to crib",
    cut: "Cut starter",
    play: "Play (pegging)",
    show: "Show",
    gameOver: "Game over",
    lobby: "Lobby",
  };
  return (
    <div className="flex items-center gap-3 text-felt-50/90">
      <span className="text-xs uppercase tracking-widest text-felt-50/60">
        Phase
      </span>
      <span className="font-display text-lg text-amber-200">
        {labels[phase] ?? phase}
      </span>
      <span className="text-xs text-felt-50/50 italic">
        dealer: {dealerName}
      </span>
    </div>
  );
}

function CribStack({
  count,
  state,
}: {
  count: number;
  isDealer: number;
  state: GameState;
}) {
  const show = state.phase === "show" && state.cribScored;
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

function DiscardPanel({
  state,
  currentHumanIdx,
  selectedDiscard,
  toggleDiscard,
  confirmDiscard,
}: {
  state: GameState;
  currentHumanIdx: number;
  selectedDiscard: string[];
  toggleDiscard: (id: string) => void;
  confirmDiscard: (idx: number) => void;
}) {
  const expected = state.players.length === 2 ? 2 : 1;
  const startSize = state.players.length === 2 ? 6 : 5;
  const me = state.players[currentHumanIdx];
  const myHand = state.hands[currentHumanIdx];
  const stillNeedsToDiscard = myHand.length > startSize - expected;

  if (!stillNeedsToDiscard) {
    return (
      <div className="text-center text-felt-50/70 italic">
        Waiting for {state.players
          .filter((p, i) => state.hands[i].length > startSize - expected)
          .map((p) => p.name)
          .join(", ") || "deal"}
        ...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-felt-50/80 font-display">
        {me.name} — pick {expected} card{expected > 1 ? "s" : ""} to discard to the{" "}
        {state.dealerIdx === currentHumanIdx ? "your" : `${state.players[state.dealerIdx].name}'s`}{" "}
        crib
      </div>
      <Hand
        cards={myHand}
        selected={selectedDiscard}
        onCardClick={(c) => toggleDiscard(c.id)}
      />
      <button
        disabled={selectedDiscard.length !== expected}
        onClick={() => confirmDiscard(currentHumanIdx)}
        className="px-5 py-2 rounded bg-amber-300 text-felt-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-200"
      >
        Send {selectedDiscard.length}/{expected} to crib
      </button>
    </div>
  );
}

function PlayPanel({
  state,
  currentHumanIdx,
  humanPlay,
}: {
  state: GameState;
  currentHumanIdx: number;
  humanPlay: (c: Card) => void;
}) {
  const isHumanTurn = state.players[state.turnIdx].kind === "human";
  const meIdx = isHumanTurn ? state.turnIdx : currentHumanIdx;
  const me = state.players[meIdx];
  const myHand = state.hands[meIdx];
  const playable = isHumanTurn ? playableCards(state, meIdx).map((c) => c.id) : [];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-felt-50/80 font-display">
        {isHumanTurn ? (
          <>
            {me.name}, play a card{" "}
            <span className="text-felt-50/50">
              (count {state.runningTotal} → max {31 - state.runningTotal})
            </span>
          </>
        ) : (
          <>
            <span className="italic text-felt-50/60">
              {state.players[state.turnIdx].name} is thinking...
            </span>
          </>
        )}
      </div>
      <Hand
        cards={myHand}
        playable={playable}
        onCardClick={(c) => humanPlay(c)}
        layoutIdPrefix="play"
      />
      {/* Show all hands at top (face down) for context, except current player */}
      <div className="flex flex-wrap gap-6 justify-center mt-3">
        {state.players.map((p, i) =>
          i === meIdx ? null : (
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

function ShowPanel({
  state,
  lastResolution,
  onNext,
  onNewHand,
}: {
  state: GameState;
  lastResolution: {
    playerIdx: number;
    isCrib: boolean;
    total: number;
    items: import("@/lib/cribbage/scoring").ScoreItem[];
  } | null;
  onNext: () => void;
  onNewHand: () => void;
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
        <button
          onClick={onNext}
          className="px-6 py-3 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
        >
          Score{" "}
          {cribRemaining && showOrderRemaining === 0
            ? "the crib"
            : `next (${showOrderRemaining + (cribRemaining ? 1 : 0)} left)`}
        </button>
      )}

      {allDone && (
        <button
          onClick={onNewHand}
          className="px-6 py-3 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
        >
          Deal Next Hand
        </button>
      )}
    </div>
  );
}

function CutPanel({
  state,
  onContinue,
}: {
  state: GameState;
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
        style={{ transformStyle: "preserve-3d" }}
      >
        <PlayingCard card={cut} size="lg" />
      </motion.div>
      {isHeels && (
        <div className="text-amber-200 font-display text-lg animate-fade-in">
          🎩 His heels! {dealer.name} scores 2
        </div>
      )}
      <button
        onClick={onContinue}
        className="px-6 py-3 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
      >
        Begin Play
      </button>
    </div>
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
