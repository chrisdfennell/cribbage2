"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useOnlineStore } from "@/store/onlineStore";
import {
  clearSession,
  joinRoomApi,
  readSession,
  subscribeToRoom,
} from "@/lib/roomClient";
import { Lobby } from "@/components/Lobby";
import { OnlineGameView } from "@/components/OnlineGameView";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const router = useRouter();
  const {
    playerId,
    snapshot,
    selectedDiscard,
    toggleDiscard,
    clearDiscardSelection,
    setSession,
    setSnapshot,
    setError,
    setConnected,
    send,
    clearSession: resetStore,
    errorMsg,
    connected,
  } = useOnlineStore();

  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);

  // Hydrate session from sessionStorage
  useEffect(() => {
    const existing = readSession();
    if (existing && existing.code === code) {
      setSession(existing.code, existing.playerId);
    }
  }, [code, setSession]);

  // Subscribe to SSE
  useEffect(() => {
    if (!playerId) return;
    const cleanup = subscribeToRoom(
      code,
      (snap) => {
        setSnapshot(snap);
        setConnected(true);
        setError(null);
      },
      (err) => {
        setError(err);
      },
    );
    return () => {
      cleanup();
      setConnected(false);
    };
  }, [code, playerId, setSnapshot, setConnected, setError]);

  // Join flow
  async function handleJoin() {
    setJoinErr(null);
    setJoining(true);
    try {
      const session = await joinRoomApi(code, joinName);
      setSession(session.code, session.playerId);
    } catch (e) {
      setJoinErr((e as Error).message ?? "Could not join");
    } finally {
      setJoining(false);
    }
  }

  function handleLeave() {
    clearSession();
    resetStore();
    router.replace("/");
  }

  if (!playerId) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="bg-felt-700/50 border border-felt-600 rounded-2xl p-6 backdrop-blur-sm max-w-md w-full">
          <h2 className="text-2xl font-display text-amber-200 mb-2">
            Join room
          </h2>
          <div className="text-felt-50/70 text-sm mb-4">
            Room code:{" "}
            <span className="text-amber-200 font-display tracking-widest">
              {code}
            </span>
          </div>
          <label className="block mb-3">
            <div className="text-sm text-felt-50/80 mb-1">Your name</div>
            <input
              className="w-full px-3 py-2 rounded bg-felt-800 border border-felt-600 text-felt-50"
              placeholder="Your name"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              autoFocus
            />
          </label>
          {joinErr && (
            <div className="text-rose-300 text-sm mb-3">{joinErr}</div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => router.replace("/")}
              className="flex-1 py-2 rounded border border-felt-500 text-felt-50/80 hover:bg-felt-700"
            >
              Back
            </button>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="flex-[2] py-2 rounded bg-amber-300 text-felt-900 font-semibold disabled:opacity-50 hover:bg-amber-200"
            >
              {joining ? "Joining..." : "Join"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-felt-50/70">
        <div className="text-felt-50/70">Connecting to room...</div>
        {errorMsg && <div className="text-rose-300 mt-2">{errorMsg}</div>}
        {!connected && errorMsg && (
          <button
            onClick={handleLeave}
            className="mt-4 px-4 py-2 rounded bg-amber-300 text-felt-900 font-semibold hover:bg-amber-200"
          >
            Back to menu
          </button>
        )}
      </main>
    );
  }

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${code}`
      : `/room/${code}`;

  if (snapshot.phase === "lobby") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <Lobby
          snap={snapshot}
          meId={playerId}
          inviteUrl={inviteUrl}
          send={send}
        />
        <button
          onClick={handleLeave}
          className="mt-4 text-felt-50/60 hover:text-felt-50 text-sm"
        >
          ← Leave room
        </button>
        {errorMsg && (
          <div className="text-rose-300 mt-2 text-sm">{errorMsg}</div>
        )}
      </main>
    );
  }

  return (
    <OnlineGameView
      snap={snapshot}
      meId={playerId}
      selectedDiscard={selectedDiscard}
      toggleDiscard={toggleDiscard}
      clearDiscardSelection={clearDiscardSelection}
      send={send}
      onLeave={handleLeave}
    />
  );
}
