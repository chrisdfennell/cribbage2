"use client";

import { Card } from "@/lib/cribbage/cards";
import { Player } from "@/lib/cribbage/game";
import { ScoreItem } from "@/lib/cribbage/scoring";
import { Hand } from "./Hand";
import { PlayingCard } from "./PlayingCard";

export interface LastHandRecapData {
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
}

interface LastHandRecapProps {
  recap: LastHandRecapData;
  players: Player[];
  teamLabel: (teamIdx: number) => string;
}

function kindShort(kind: string): string {
  switch (kind) {
    case "fifteen":
      return "15";
    case "pair":
      return "pair";
    case "run":
      return "run";
    case "flush":
      return "flush";
    case "nobs":
      return "nobs";
    case "heels":
      return "heels";
    default:
      return kind;
  }
}

export function LastHandRecap({
  recap,
  players,
  teamLabel,
}: LastHandRecapProps) {
  return (
    <div className="space-y-3 text-felt-50/85 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-felt-50/60">Dealer:</span>
        <span className="text-amber-100">
          {players[recap.dealerIdx].name}
        </span>
        {recap.starter && (
          <>
            <span className="text-felt-50/60 ml-3">Cut:</span>
            <div className="-my-1">
              <PlayingCard card={recap.starter} size="sm" />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {recap.handsByPlayer.map((cards, i) => {
          const ev = recap.showEvents.find(
            (e) => e.playerIdx === i && !e.isCrib,
          );
          return (
            <div
              key={i}
              className="bg-felt-900/40 rounded p-2 border border-felt-700"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-amber-100">{players[i].name}</span>
                {ev && (
                  <span className="text-amber-200 font-bold tabular-nums">
                    +{ev.total}
                  </span>
                )}
              </div>
              <Hand cards={cards} size="sm" />
              {ev && ev.items.length > 0 && (
                <div className="text-xs text-felt-50/65 mt-1">
                  {ev.items
                    .map((it) => `${kindShort(it.kind)} +${it.points}`)
                    .join(" · ")}
                </div>
              )}
            </div>
          );
        })}
        {recap.crib.length > 0 && (
          <div className="bg-felt-900/40 rounded p-2 border border-felt-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-amber-100">
                {players[recap.dealerIdx].name}&rsquo;s crib
              </span>
              {(() => {
                const ev = recap.showEvents.find((e) => e.isCrib);
                return ev ? (
                  <span className="text-amber-200 font-bold tabular-nums">
                    +{ev.total}
                  </span>
                ) : null;
              })()}
            </div>
            <Hand cards={recap.crib} size="sm" />
            {(() => {
              const ev = recap.showEvents.find((e) => e.isCrib);
              return ev && ev.items.length > 0 ? (
                <div className="text-xs text-felt-50/65 mt-1">
                  {ev.items
                    .map((it) => `${kindShort(it.kind)} +${it.points}`)
                    .join(" · ")}
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {recap.scoresByTeam.map((s) => (
          <span
            key={s.teamIdx}
            className="bg-felt-900/40 rounded px-2 py-1 border border-felt-700"
          >
            {teamLabel(s.teamIdx)}: hand{" "}
            <span className="text-amber-200 font-bold">+{s.gained}</span>{" "}
            (total {s.total})
          </span>
        ))}
      </div>
    </div>
  );
}
