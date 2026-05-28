"use client";

import { Card } from "@/lib/cribbage/cards";
import { PlayingCard } from "./PlayingCard";
import { cn } from "@/lib/utils";

interface HandProps {
  cards: Card[];
  faceDown?: boolean;
  selected?: string[];
  playable?: string[];
  onCardClick?: (card: Card) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
  /** Optional prefix for layoutIds so framer-motion can animate cards moving between
   * this hand and another container that uses the same prefix on its cards. */
  layoutIdPrefix?: string;
}

export function Hand({
  cards,
  faceDown,
  selected = [],
  playable,
  onCardClick,
  size = "md",
  label,
  className,
  layoutIdPrefix,
}: HandProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      {label && (
        <div className="text-felt-50/80 text-sm font-display tracking-wide">
          {label}
        </div>
      )}
      <div className="flex gap-1 sm:gap-2 flex-wrap justify-center">
        {cards.map((c) => {
          const isSelected = selected.includes(c.id);
          const isPlayable = !playable || playable.includes(c.id);
          return (
            <PlayingCard
              key={c.id}
              card={c}
              faceDown={faceDown}
              selected={isSelected}
              disabled={!isPlayable}
              size={size}
              onClick={
                onCardClick && isPlayable ? () => onCardClick(c) : undefined
              }
              layoutId={layoutIdPrefix ? `${layoutIdPrefix}-${c.id}` : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
