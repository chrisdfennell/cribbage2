"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { createRoomApi } from "@/lib/roomClient";

type Mode = "menu" | "ai" | "hotseat" | "online";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("menu");

  const startVsAi = useGameStore((s) => s.startVsAi);
  const startHotseat = useGameStore((s) => s.startHotseat);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-6xl md:text-7xl font-display text-amber-200 text-center text-shadow-sm tracking-wide">
          Cribbage
        </h1>
        <p className="text-center text-felt-50/70 italic mt-2 mb-10">
          A traditional card game, beautifully reimagined.
        </p>

        {mode === "menu" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MenuCard
              title="Play vs AI"
              subtitle="1 human + 1-3 AI opponents."
              onClick={() => setMode("ai")}
            />
            <MenuCard
              title="Local Hotseat"
              subtitle="2-4 humans pass-and-play on one device."
              onClick={() => setMode("hotseat")}
            />
            <MenuCard
              title="Online Room"
              subtitle="Create or join a room with a 4-letter code."
              onClick={() => setMode("online")}
            />
            <MenuCard
              title="How to Play"
              subtitle="Read the rules and scoring guide."
              onClick={() => router.push("/play?rules=1")}
            />
          </div>
        )}

        {mode === "ai" && (
          <VsAiSetup
            onBack={() => setMode("menu")}
            onStart={(opts) => {
              startVsAi(opts);
              router.push("/play");
            }}
          />
        )}

        {mode === "hotseat" && (
          <HotseatSetup
            onBack={() => setMode("menu")}
            onStart={(opts) => {
              startHotseat(opts);
              router.push("/play");
            }}
          />
        )}

        {mode === "online" && (
          <OnlineSetup onBack={() => setMode("menu")} />
        )}
      </div>
    </main>
  );
}

function OnlineSetup({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate() {
    setErr(null);
    setBusy(true);
    try {
      const { code } = await createRoomApi(name || "Host");
      router.push(`/room/${code}`);
    } catch (e) {
      setErr((e as Error).message ?? "Could not create room");
    } finally {
      setBusy(false);
    }
  }

  function handleJoin() {
    const c = joinCode.trim().toUpperCase();
    if (c.length !== 4) {
      setErr("Room codes are 4 letters");
      return;
    }
    router.push(`/room/${c}`);
  }

  return (
    <div className="bg-felt-700/50 border border-felt-600 rounded-2xl p-6 backdrop-blur-sm">
      <h2 className="text-2xl font-display text-amber-200 mb-4">
        Online Room
      </h2>

      <label className="block mb-4">
        <div className="text-sm text-felt-50/80 mb-1">Your name</div>
        <input
          className="w-full px-3 py-2 rounded bg-felt-800 border border-felt-600 text-felt-50"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-felt-800/60 rounded p-4 border border-felt-700">
          <div className="text-amber-100 font-display mb-2">Create</div>
          <p className="text-sm text-felt-50/70 mb-3">
            Start a new room. You&rsquo;ll be the host and get a code to share.
          </p>
          <button
            onClick={handleCreate}
            disabled={busy}
            className="w-full py-2 rounded bg-amber-300 text-felt-900 font-semibold disabled:opacity-50 hover:bg-amber-200"
          >
            {busy ? "Creating..." : "Create Room"}
          </button>
        </div>

        <div className="bg-felt-800/60 rounded p-4 border border-felt-700">
          <div className="text-amber-100 font-display mb-2">Join</div>
          <p className="text-sm text-felt-50/70 mb-3">Enter the 4-letter code.</p>
          <input
            className="w-full px-3 py-2 rounded bg-felt-900 border border-felt-600 text-felt-50 text-center font-display text-2xl tracking-widest mb-2 uppercase"
            placeholder="XXXX"
            maxLength={4}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <button
            onClick={handleJoin}
            className="w-full py-2 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
          >
            Join Room
          </button>
        </div>
      </div>

      {err && <div className="text-rose-300 mt-3 text-sm">{err}</div>}

      <button
        onClick={onBack}
        className="mt-6 w-full py-2 rounded border border-felt-500 text-felt-50/80 hover:bg-felt-700"
      >
        Back
      </button>
    </div>
  );
}

function MenuCard({
  title,
  subtitle,
  onClick,
  disabled,
}: {
  title: string;
  subtitle: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left p-5 rounded-2xl border transition group ${
        disabled
          ? "bg-felt-800/30 border-felt-700 text-felt-50/40 cursor-not-allowed"
          : "bg-felt-700/40 border-felt-600 hover:border-amber-300 hover:bg-felt-700/60"
      }`}
    >
      <div className="text-xl font-display text-amber-200 mb-1 group-hover:text-amber-100">
        {title}
      </div>
      <div className="text-sm text-felt-50/70">{subtitle}</div>
    </button>
  );
}

function VsAiSetup({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (opts: {
    playerName: string;
    aiLevel: "easy" | "medium" | "hard";
    numAi: 1 | 2 | 3;
    partnership?: boolean;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [aiLevel, setAiLevel] = useState<"easy" | "medium" | "hard">("medium");
  const [numAi, setNumAi] = useState<1 | 2 | 3>(1);
  const [partnership, setPartnership] = useState(false);
  const total = 1 + numAi;
  return (
    <div className="bg-felt-700/50 border border-felt-600 rounded-2xl p-6 backdrop-blur-sm">
      <h2 className="text-2xl font-display text-amber-200 mb-4">Play vs AI</h2>
      <label className="block mb-3">
        <div className="text-sm text-felt-50/80 mb-1">Your name</div>
        <input
          className="w-full px-3 py-2 rounded bg-felt-800 border border-felt-600 text-felt-50"
          placeholder="You"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <Segmented
        label="Number of AI opponents"
        value={String(numAi)}
        options={[
          { value: "1", label: "1 AI (2 players)" },
          { value: "2", label: "2 AI (3 players)" },
          { value: "3", label: "3 AI (4 players)" },
        ]}
        onChange={(v) => setNumAi(Number(v) as 1 | 2 | 3)}
      />

      <Segmented
        label="AI difficulty"
        value={aiLevel}
        options={[
          { value: "easy", label: "Easy" },
          { value: "medium", label: "Medium" },
          { value: "hard", label: "Hard" },
        ]}
        onChange={(v) => setAiLevel(v as "easy" | "medium" | "hard")}
      />

      {total === 4 && (
        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={partnership}
              onChange={(e) => setPartnership(e.target.checked)}
              className="h-4 w-4 accent-amber-400"
            />
            <span className="text-sm text-felt-50/85">
              Partnership (2v2 — you team with the AI seated across)
            </span>
          </label>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 py-2 rounded border border-felt-500 text-felt-50/80 hover:bg-felt-700"
        >
          Back
        </button>
        <button
          onClick={() =>
            onStart({
              playerName: name || "You",
              aiLevel,
              numAi,
              partnership: total === 4 ? partnership : undefined,
            })
          }
          className="flex-[2] py-2 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

function HotseatSetup({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (opts: { names: string[]; partnership?: boolean }) => void;
}) {
  const [count, setCount] = useState<2 | 3 | 4>(2);
  const [names, setNames] = useState<string[]>(["", "", "", ""]);
  const [partnership, setPartnership] = useState(false);

  function setName(idx: number, v: string) {
    setNames((prev) => prev.map((n, i) => (i === idx ? v : n)));
  }

  return (
    <div className="bg-felt-700/50 border border-felt-600 rounded-2xl p-6 backdrop-blur-sm">
      <h2 className="text-2xl font-display text-amber-200 mb-4">
        Local Hotseat
      </h2>

      <Segmented
        label="Number of players"
        value={String(count)}
        options={[
          { value: "2", label: "2 players" },
          { value: "3", label: "3 players" },
          { value: "4", label: "4 players" },
        ]}
        onChange={(v) => setCount(Number(v) as 2 | 3 | 4)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        {Array.from({ length: count }).map((_, i) => (
          <label key={i} className="block">
            <div className="text-sm text-felt-50/80 mb-1">Player {i + 1}</div>
            <input
              className="w-full px-3 py-2 rounded bg-felt-800 border border-felt-600 text-felt-50"
              placeholder={`Player ${i + 1}`}
              value={names[i]}
              onChange={(e) => setName(i, e.target.value)}
            />
          </label>
        ))}
      </div>

      {count === 4 && (
        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={partnership}
              onChange={(e) => setPartnership(e.target.checked)}
              className="h-4 w-4 accent-amber-400"
            />
            <span className="text-sm text-felt-50/85">
              Partnership (teams: 1 &amp; 3 vs 2 &amp; 4)
            </span>
          </label>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 py-2 rounded border border-felt-500 text-felt-50/80 hover:bg-felt-700"
        >
          Back
        </button>
        <button
          onClick={() =>
            onStart({
              names: names.slice(0, count),
              partnership: count === 4 ? partnership : undefined,
            })
          }
          className="flex-[2] py-2 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-3">
      <div className="text-sm text-felt-50/80 mb-1">{label}</div>
      <div className="flex gap-2 flex-wrap">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 min-w-[100px] py-2 rounded border ${
              value === o.value
                ? "bg-amber-300 text-felt-900 border-amber-200 font-semibold"
                : "bg-felt-800 text-felt-50/80 border-felt-600 hover:bg-felt-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
