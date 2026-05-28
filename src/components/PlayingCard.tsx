"use client";

import { Card as CardModel, cardLabel, suitColor } from "@/lib/cribbage/cards";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PlayingCardProps {
  card?: CardModel | null;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  className?: string;
  draggable?: boolean;
  highlight?: boolean;
  /** When set, framer-motion animates between containers sharing the same layoutId. */
  layoutId?: string;
}

const SIZE_CLASS: Record<string, string> = {
  sm: "w-10 h-14 text-[10px] sm:w-12 sm:h-16 sm:text-xs",
  md: "w-14 h-20 text-xs sm:w-16 sm:h-24 sm:text-sm",
  lg: "w-16 h-24 text-sm sm:w-20 sm:h-28 sm:text-base",
};

export function PlayingCard({
  card,
  faceDown,
  selected,
  disabled,
  size = "md",
  onClick,
  className,
  highlight,
  layoutId,
}: PlayingCardProps) {
  if (!card || faceDown) {
    return (
      <motion.div
        layout
        layoutId={layoutId}
        whileHover={onClick && !disabled ? { y: -6 } : undefined}
        whileTap={onClick && !disabled ? { scale: 0.97 } : undefined}
        onClick={onClick && !disabled ? onClick : undefined}
        className={cn(
          "rounded-lg border border-slate-900 shadow-lg flex items-center justify-center select-none",
          "bg-gradient-to-br from-rose-700 via-rose-800 to-rose-950",
          SIZE_CLASS[size],
          className,
        )}
      >
        <div className="w-3/4 h-3/4 rounded border border-rose-300/40 flex items-center justify-center">
          <div className="text-rose-200/40 font-display text-xl">♣</div>
        </div>
      </motion.div>
    );
  }

  const color = suitColor(card.suit) === "red" ? "text-rose-600" : "text-slate-900";
  const label = cardLabel(card);
  const rank = label.slice(0, -1);
  const suit = label.slice(-1);

  return (
    <motion.div
      layout
      layoutId={layoutId}
      whileHover={onClick && !disabled ? { y: -10 } : undefined}
      whileTap={onClick && !disabled ? { scale: 0.97 } : undefined}
      onClick={onClick && !disabled ? onClick : undefined}
      className={cn(
        "rounded-lg border bg-white shadow-lg flex flex-col p-1 select-none relative",
        SIZE_CLASS[size],
        selected
          ? "border-amber-400 ring-2 ring-amber-300 -translate-y-2"
          : "border-slate-300",
        highlight ? "ring-2 ring-emerald-400" : "",
        disabled ? "opacity-50 cursor-not-allowed" : onClick ? "cursor-pointer" : "",
        className,
      )}
    >
      <div className={cn("flex flex-col items-start leading-none", color)}>
        <div className="font-bold">{rank}</div>
        <div className="text-base leading-none">{suit}</div>
      </div>
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center text-2xl font-bold",
          color,
        )}
      >
        {suit}
      </div>
      <div
        className={cn(
          "absolute bottom-1 right-1 flex flex-col items-end leading-none rotate-180",
          color,
        )}
      >
        <div className="font-bold">{rank}</div>
        <div className="text-base leading-none">{suit}</div>
      </div>
    </motion.div>
  );
}
