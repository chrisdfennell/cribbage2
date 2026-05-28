"use client";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext ||
        // @ts-expect-error - vendor prefix on older Safari
        window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

type Tone = {
  freq: number;
  durMs: number;
  type?: OscillatorType;
  gain?: number;
  // tiny pitch sweep
  sweepTo?: number;
};

function tone({ freq, durMs, type = "sine", gain = 0.18, sweepTo }: Tone) {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const dur = durMs / 1000;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(sweepTo, now + dur);
  }
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

export const sounds = {
  cardPlay() {
    tone({ freq: 220, durMs: 70, type: "triangle", gain: 0.12, sweepTo: 180 });
  },
  pegMove(points: number) {
    // higher pitch + longer for bigger scores
    const base = 540;
    tone({
      freq: base,
      durMs: 90 + Math.min(points * 12, 200),
      type: "square",
      gain: 0.1,
      sweepTo: base + Math.min(points * 60, 600),
    });
  },
  score(points: number) {
    // ascending arpeggio
    const notes = [523, 659, 784, 988]; // C5 E5 G5 B5
    const steps = Math.min(Math.max(2, Math.floor(points / 2) + 1), notes.length);
    for (let i = 0; i < steps; i++) {
      setTimeout(
        () =>
          tone({
            freq: notes[i],
            durMs: 130,
            type: "triangle",
            gain: 0.14,
          }),
        i * 80,
      );
    }
  },
  cut() {
    tone({ freq: 380, durMs: 220, type: "sine", gain: 0.15, sweepTo: 480 });
  },
  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) =>
      setTimeout(
        () => tone({ freq: n, durMs: 220, type: "triangle", gain: 0.18 }),
        i * 130,
      ),
    );
  },
  click() {
    tone({ freq: 880, durMs: 40, type: "sine", gain: 0.08 });
  },
};
