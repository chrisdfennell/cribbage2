"use client";

import { motion, AnimatePresence } from "framer-motion";

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export function RulesModal({ open, onClose }: RulesModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            className="bg-felt-800 border border-felt-600 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-3xl font-display text-amber-200">
                How to play Cribbage
              </h2>
              <button
                onClick={onClose}
                className="text-felt-50/60 hover:text-felt-50 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="text-felt-50/90 space-y-4 text-sm leading-relaxed">
              <section>
                <h3 className="font-bold text-amber-100 mb-1">Goal</h3>
                <p>
                  Be the first player to peg 121 points. Score by playing cards
                  in combinations and by showing strong hands at the end of each
                  deal.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-amber-100 mb-1">Each hand</h3>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    <b>Deal.</b> Dealer deals 6 cards to each player (2-player
                    game).
                  </li>
                  <li>
                    <b>Discard.</b> Each player discards 2 cards to the dealer&rsquo;s
                    crib.
                  </li>
                  <li>
                    <b>Cut.</b> A starter card is cut. If it&rsquo;s a Jack, the
                    dealer scores 2 (&ldquo;his heels&rdquo;).
                  </li>
                  <li>
                    <b>Play (pegging).</b> Players alternate playing cards,
                    keeping the running count ≤ 31, scoring combinations as
                    they go.
                  </li>
                  <li>
                    <b>Show.</b> Each player counts their 4-card hand using
                    the starter as a fifth card. The dealer then counts the
                    crib.
                  </li>
                  <li>
                    Swap dealer; repeat until someone reaches 121.
                  </li>
                </ol>
              </section>

              <section>
                <h3 className="font-bold text-amber-100 mb-1">
                  Pegging (play) scoring
                </h3>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Make the count 15 → 2 points</li>
                  <li>Make the count 31 → 2 points (then pile resets)</li>
                  <li>Pair → 2 / Triple → 6 / Four of a kind → 12</li>
                  <li>Run of 3+ in the recent tail (any order) → 1 per card</li>
                  <li>
                    &ldquo;Go&rdquo;: when the opponent can&rsquo;t play, last
                    card to play gets 1
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="font-bold text-amber-100 mb-1">
                  Show (hand) scoring
                </h3>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>
                    <b>Fifteens:</b> 2 points per combination that sums to 15
                    (A=1, J/Q/K=10)
                  </li>
                  <li>
                    <b>Pairs:</b> 2 per pair. Triple = 6, four of a kind = 12
                  </li>
                  <li>
                    <b>Runs:</b> 1 point per card in a run of 3+. Duplicates
                    multiply: e.g. 4-4-5-6 = two runs of 3 (6 pts)
                  </li>
                  <li>
                    <b>Flush:</b> 4 in hand (4 pts) + cut matching (5 pts).
                    Crib only counts a 5-card flush.
                  </li>
                  <li>
                    <b>Nobs:</b> Jack in hand matching the cut card&rsquo;s
                    suit = 1
                  </li>
                </ul>
              </section>

              <section className="text-xs text-felt-50/60 italic">
                The highest possible hand is 29 (J + three 5s + cut 5 of the
                Jack&rsquo;s suit).
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
