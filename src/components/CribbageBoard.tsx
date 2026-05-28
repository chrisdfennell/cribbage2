"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type PegColor = "red" | "blue" | "green" | "yellow";

export interface BoardTrack {
  id: string;
  label: string;
  color: PegColor;
  score: number;
  prevScore: number;
  /** Highlighted (e.g. team includes the current player) */
  active?: boolean;
}

interface CribbageBoardProps {
  tracks: BoardTrack[];
  className?: string;
}

const BOARD_W = 980;
const BASE_PADDING_X = 60;
const BASE_PADDING_Y = 50;

// 3 streets × 40 holes
const HOLES_PER_STREET = 40;
const STREETS = 3;
const HOLE_RADIUS = 5;

const PEG_COLORS: Record<
  PegColor,
  { fill: string; rim: string; cap: string }
> = {
  red: { fill: "#e94545", rim: "#7a1f1f", cap: "#ffb3b3" },
  blue: { fill: "#3577e0", rim: "#1c3e7a", cap: "#a6c8ff" },
  green: { fill: "#36a85a", rim: "#185529", cap: "#9fe4b5" },
  yellow: { fill: "#e7b526", rim: "#7a5e0f", cap: "#f6e1a0" },
};

interface Point {
  x: number;
  y: number;
}

function streetHeight(boardH: number): number {
  const usableH = boardH - BASE_PADDING_Y * 2;
  return usableH / STREETS;
}

function streetY(
  boardH: number,
  streetIdx: number,
  totalRows: number,
  rowInStreet: number,
) {
  const sH = streetHeight(boardH);
  const streetTop = BASE_PADDING_Y + streetIdx * sH;
  const rowH = sH / (totalRows + 1);
  return streetTop + rowH * (rowInStreet + 1);
}

function holeX(posInStreet: number, direction: "right" | "left") {
  const usableW = BOARD_W - BASE_PADDING_X * 2;
  const groups = 8;
  const groupGap = 8;
  const holeArea = usableW - groupGap * (groups - 1);
  const holeSpacing = holeArea / (HOLES_PER_STREET - 1);
  const groupIdx = Math.floor(posInStreet / 5);
  const xLeft =
    BASE_PADDING_X + posInStreet * holeSpacing + groupIdx * groupGap;
  if (direction === "right") return xLeft;
  return BOARD_W - xLeft;
}

function holePosition(
  score: number,
  trackIdx: number,
  numTracks: number,
  boardH: number,
): Point {
  if (score === 0) {
    return {
      x: BASE_PADDING_X - 30,
      y: streetY(boardH, 0, numTracks, trackIdx),
    };
  }
  if (score >= 121) {
    return {
      x: BOARD_W - BASE_PADDING_X + 30,
      y: streetY(boardH, STREETS - 1, numTracks, trackIdx),
    };
  }
  const streetIdx = Math.floor((score - 1) / HOLES_PER_STREET);
  const posInStreet = (score - 1) % HOLES_PER_STREET;
  const direction: "right" | "left" = streetIdx % 2 === 0 ? "right" : "left";
  return {
    x: holeX(posInStreet, direction),
    y: streetY(boardH, streetIdx, numTracks, trackIdx),
  };
}

function generateHoles(
  trackIdx: number,
  numTracks: number,
  boardH: number,
): Point[] {
  const out: Point[] = [];
  for (let s = 1; s <= 120; s++) {
    out.push(holePosition(s, trackIdx, numTracks, boardH));
  }
  return out;
}

export function CribbageBoard({ tracks, className }: CribbageBoardProps) {
  const numTracks = tracks.length;
  // expand board height for more tracks so holes stay readable
  const boardH = Math.max(380, 230 + numTracks * 55);
  const allHoles = useMemo(
    () => tracks.map((_, idx) => generateHoles(idx, numTracks, boardH)),
    [tracks, numTracks, boardH],
  );

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${BOARD_W} ${boardH}`}
        className="w-full h-auto drop-shadow-2xl"
        aria-label="Cribbage board"
      >
        <defs>
          <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b4a1a" />
            <stop offset="50%" stopColor="#8e6627" />
            <stop offset="100%" stopColor="#523710" />
          </linearGradient>
          <linearGradient id="hole-shadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1004" />
            <stop offset="100%" stopColor="#3a2810" />
          </linearGradient>
          <pattern
            id="grain"
            x="0"
            y="0"
            width="200"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <rect width="200" height="40" fill="url(#wood)" />
            <path
              d="M0 10 Q50 6 100 10 T200 10"
              stroke="#3a280b"
              strokeWidth="0.5"
              fill="none"
              opacity="0.3"
            />
            <path
              d="M0 22 Q60 18 120 22 T200 22"
              stroke="#3a280b"
              strokeWidth="0.4"
              fill="none"
              opacity="0.25"
            />
            <path
              d="M0 32 Q40 28 80 32 T200 32"
              stroke="#3a280b"
              strokeWidth="0.5"
              fill="none"
              opacity="0.3"
            />
          </pattern>
        </defs>

        <rect
          x="4"
          y="4"
          width={BOARD_W - 8}
          height={boardH - 8}
          rx="22"
          fill="url(#grain)"
          stroke="#3a280b"
          strokeWidth="3"
        />
        <rect
          x="18"
          y="18"
          width={BOARD_W - 36}
          height={boardH - 36}
          rx="16"
          fill="none"
          stroke="#3a280b"
          strokeWidth="1.5"
          opacity="0.4"
        />

        <text
          x={BASE_PADDING_X - 38}
          y={BASE_PADDING_Y - 14}
          fontSize="13"
          fill="#e6cc97"
          fontFamily="Georgia, serif"
          fontStyle="italic"
        >
          start
        </text>
        <text
          x={BOARD_W - BASE_PADDING_X - 6}
          y={boardH - BASE_PADDING_Y + 24}
          fontSize="13"
          fill="#e6cc97"
          fontFamily="Georgia, serif"
          fontStyle="italic"
        >
          game
        </text>

        {tracks.map((track, trackIdx) => {
          const holes = allHoles[trackIdx];
          const colors = PEG_COLORS[track.color];
          const score = Math.min(track.score, 121);
          const prev = Math.min(track.prevScore, 121);
          const frontPos = holePosition(score, trackIdx, numTracks, boardH);
          const backPos = holePosition(prev, trackIdx, numTracks, boardH);
          return (
            <g key={track.id}>
              <g opacity="0.18">
                {holes.map((h, i) =>
                  i > 0 && Math.floor((i - 1) / 40) === Math.floor(i / 40) ? (
                    <line
                      key={i}
                      x1={holes[i - 1].x}
                      y1={holes[i - 1].y}
                      x2={h.x}
                      y2={h.y}
                      stroke="#1a1004"
                      strokeWidth="1.2"
                    />
                  ) : null,
                )}
              </g>
              {holes.map((h, i) => {
                const isGroupBoundary = (i + 1) % 5 === 0;
                return (
                  <circle
                    key={i}
                    cx={h.x}
                    cy={h.y}
                    r={HOLE_RADIUS}
                    fill="url(#hole-shadow)"
                    stroke="#1a1004"
                    strokeWidth={isGroupBoundary ? 0.8 : 0.4}
                  />
                );
              })}
              <circle
                cx={BASE_PADDING_X - 30}
                cy={streetY(boardH, 0, numTracks, trackIdx)}
                r={HOLE_RADIUS + 1}
                fill="url(#hole-shadow)"
                stroke="#1a1004"
              />
              <circle
                cx={BOARD_W - BASE_PADDING_X + 30}
                cy={streetY(boardH, STREETS - 1, numTracks, trackIdx)}
                r={HOLE_RADIUS + 2}
                fill="url(#hole-shadow)"
                stroke="#e0b020"
                strokeWidth="1.5"
              />

              <Peg pos={backPos} color={colors} />
              <Peg pos={frontPos} color={colors} front active={track.active} />

              <text
                x={BASE_PADDING_X - 50}
                y={streetY(boardH, 0, numTracks, trackIdx) - 14}
                fontSize="12"
                fill={colors.fill}
                fontFamily="Georgia, serif"
                fontWeight="bold"
              >
                {track.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Peg({
  pos,
  color,
  front,
  active,
}: {
  pos: Point;
  color: { fill: string; rim: string; cap: string };
  front?: boolean;
  active?: boolean;
}) {
  return (
    <motion.g
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      initial={{ x: pos.x, y: pos.y }}
    >
      <ellipse cx={0} cy={4} rx={6} ry={2} fill="#000" opacity="0.35" />
      <circle
        cx={0}
        cy={0}
        r={6.5}
        fill={color.fill}
        stroke={color.rim}
        strokeWidth="1.5"
      />
      <circle cx={-1.5} cy={-1.5} r={2.5} fill={color.cap} opacity="0.85" />
      {front && (
        <>
          <circle
            cx={0}
            cy={0}
            r={8.5}
            fill="none"
            stroke={color.fill}
            strokeWidth="1"
            opacity="0.5"
          />
          {active && (
            <motion.circle
              cx={0}
              cy={0}
              r={11}
              fill="none"
              stroke={color.fill}
              strokeWidth="1.5"
              opacity="0.7"
              animate={{ r: [11, 14, 11], opacity: [0.7, 0.2, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
          )}
        </>
      )}
    </motion.g>
  );
}
