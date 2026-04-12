/** Poker lobby — list tables, quick join, create new. */

"use client";

import { useState, useEffect, useCallback } from "react";

const API = typeof window !== "undefined" ? `${window.location.origin}/api/v1/holdem` : "";

interface RoomSummary {
  roomId: string;
  players: number;
  maxPlayers: number;
  phase: string;
}

export function Lobby({ onJoin }: { onJoin: (roomId: string) => void }) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}/rooms`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setRooms((data as { rooms: RoomSummary[] }).rooms ?? []);
      setError(null);
    } catch (e) {
      setError("Cannot reach game server");
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const quickJoin = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API}/quick-join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const id = (data as { roomId: string }).roomId;
      if (id) onJoin(id);
      else throw new Error("No roomId returned");
    } catch (e) {
      setError("Failed to join. Is the backend running?");
    }
  }, [onJoin]);

  const createRoom = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const id = (data as { roomId: string }).roomId;
      if (id) onJoin(id);
      else throw new Error("No roomId returned");
    } catch (e) {
      setError("Failed to create table. Is the backend running?");
    }
  }, [onJoin]);

  return (
    <div className="max-w-lg">
      {/* Quick actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={quickJoin}
          className="rounded-lg bg-brand px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-dim hover:scale-105 active:scale-95"
        >
          Quick Join
        </button>
        <button
          onClick={createRoom}
          className="rounded-lg border border-surface-3 px-6 py-3 text-sm text-slate-300 transition hover:border-brand hover:text-slate-100"
        >
          New Table
        </button>
        <button
          onClick={refresh}
          className="rounded-lg border border-surface-3 px-4 py-3 text-sm text-slate-500 transition hover:text-slate-300"
        >
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Room list */}
      {loading ? (
        <div className="text-sm text-slate-500">Loading tables...</div>
      ) : rooms.length === 0 ? (
        <div className="rounded-lg border border-surface-3 bg-surface-1 p-6 text-sm text-slate-500">
          No tables yet. Click &ldquo;Quick Join&rdquo; to create one and start playing.
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map((r) => (
            <button
              key={r.roomId}
              onClick={() => onJoin(r.roomId)}
              className="flex w-full items-center justify-between rounded-lg border border-surface-3 bg-surface-1 p-4 text-left transition hover:border-brand"
            >
              <div>
                <div className="text-sm font-medium text-slate-200">
                  Table {r.roomId.slice(0, 6)}
                </div>
                <div className="text-xs text-slate-500">
                  {r.phase === "waiting" ? "Waiting to start" : `In progress`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-brand-glow">
                  {r.players}/6 players
                </div>
                <div className="text-xs text-slate-500">Join</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
