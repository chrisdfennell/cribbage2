"use client";

import { motion } from "framer-motion";
import { Player } from "@/lib/cribbage/game";

interface HandoffOverlayProps {
  player: Player;
  onReady: () => void;
}

const PEG_COLORS: Record<string, string> = {
  red: "#e94545",
  blue: "#3577e0",
  green: "#36a85a",
  yellow: "#e7b526",
};

export function HandoffOverlay({ player, onReady }: HandoffOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-felt-900/95 backdrop-blur-sm flex flex-col items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="bg-felt-800 border-2 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
        style={{ borderColor: PEG_COLORS[player.color] }}
      >
        <div className="text-felt-50/60 uppercase tracking-widest text-xs mb-3">
          Pass the device
        </div>
        <div
          className="text-4xl md:text-5xl font-display mb-2"
          style={{ color: PEG_COLORS[player.color] }}
        >
          {player.name}
        </div>
        <div className="text-felt-50/80 mb-8">It&rsquo;s your turn.</div>
        <button
          onClick={onReady}
          className="px-6 py-3 rounded-xl bg-amber-300 text-felt-900 font-semibold text-lg hover:bg-amber-200 active:scale-95 transition"
        >
          I&rsquo;m ready
        </button>
      </motion.div>
    </motion.div>
  );
}
