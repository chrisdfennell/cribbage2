"use client";

import { RoomSnapshot } from "@/server/rooms";
import { RoomAction } from "@/lib/roomClient";

const PEG_COLORS: Record<string, string> = {
  red: "#e94545",
  blue: "#3577e0",
  green: "#36a85a",
  yellow: "#e7b526",
};

interface LobbyProps {
  snap: RoomSnapshot;
  meId: string;
  inviteUrl: string;
  send: (action: RoomAction) => void | Promise<void>;
}

export function Lobby({ snap, meId, inviteUrl, send }: LobbyProps) {
  const isHost = meId === snap.hostId;
  const playerCount = snap.lobbyPlayers.length;
  const canStart = playerCount >= 2;
  const canAddAi = playerCount < 4;
  const canTogglePartnership = playerCount === 4;

  return (
    <div className="max-w-2xl w-full mx-auto bg-felt-700/50 border border-felt-600 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-felt-50/70 text-sm uppercase tracking-widest">
            Room code
          </div>
          <div className="text-5xl font-display text-amber-200 tracking-[0.4em]">
            {snap.code}
          </div>
        </div>
        <button
          onClick={() => {
            try {
              navigator.clipboard.writeText(inviteUrl);
            } catch {
              /* ignore */
            }
          }}
          className="self-end text-sm border border-felt-500 rounded px-3 py-1 text-felt-50/80 hover:bg-felt-700"
        >
          Copy invite link
        </button>
      </div>

      <div className="text-felt-50/70 text-sm mb-2">
        Players ({playerCount}/4)
      </div>
      <ul className="space-y-2 mb-4">
        {snap.lobbyPlayers.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 bg-felt-800/60 rounded p-2 border border-felt-700"
          >
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: PEG_COLORS[p.color] }}
            />
            <span className="font-display text-felt-50">
              {p.name}
              {p.id === snap.hostId && (
                <span className="text-xs text-amber-300 ml-2">host</span>
              )}
              {p.id === meId && (
                <span className="text-xs text-felt-50/60 ml-2">(you)</span>
              )}
            </span>
            <span className="text-xs text-felt-50/60 ml-1">
              {p.kind === "ai" ? `AI (${p.aiLevel ?? "medium"})` : "human"}
            </span>
            {isHost && p.id !== snap.hostId && (
              <button
                onClick={() =>
                  send({ type: "remove-player", playerId: p.id })
                }
                className="ml-auto text-xs text-felt-50/50 hover:text-rose-300"
              >
                remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {isHost && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {canAddAi && (
              <>
                <span className="text-sm text-felt-50/70 self-center mr-1">
                  Add AI:
                </span>
                {(["easy", "medium", "hard"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => send({ type: "add-ai", level: l })}
                    className="text-sm px-3 py-1 rounded border border-felt-500 text-felt-50/85 hover:bg-felt-700"
                  >
                    + {l}
                  </button>
                ))}
              </>
            )}
          </div>

          {canTogglePartnership && (
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={snap.partnership}
                onChange={(e) =>
                  send({
                    type: "set-partnership",
                    partnership: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-amber-400"
              />
              <span className="text-sm text-felt-50/85">
                Partnership (teams: 1 &amp; 3 vs 2 &amp; 4)
              </span>
            </label>
          )}

          <button
            disabled={!canStart}
            onClick={() => send({ type: "start-game" })}
            className="w-full py-3 rounded bg-amber-300 text-felt-900 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-200"
          >
            Start Game
          </button>
        </>
      )}

      {!isHost && (
        <div className="text-center text-felt-50/70 italic">
          Waiting for {snap.lobbyPlayers.find((p) => p.id === snap.hostId)?.name ?? "the host"}{" "}
          to start...
        </div>
      )}
    </div>
  );
}
