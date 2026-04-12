/** Client-side wrapper: password gate → lobby → live game. */

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Lobby } from "@/components/holdem/Lobby";
import { MultiplayerTable } from "@/components/holdem/MultiplayerTable";

const PASSWORD = "tidoshi";

export function HoldemClient() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);

  const handleLogin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (pw.trim().toLowerCase() === PASSWORD) {
        setAuthed(true);
        setError(false);
      } else {
        setError(true);
      }
    },
    [pw],
  );

  // Password gate
  if (!authed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm rounded-xl border border-surface-3 bg-surface-1 p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold text-slate-100">Tide Hold&apos;em</h1>
          <p className="mt-2 text-sm text-slate-400">Enter the password and your name to play.</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-3">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name"
              autoFocus
              className="w-full rounded-lg border border-surface-3 bg-surface-2 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <input
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(false); }}
              placeholder="Password"
              className="w-full rounded-lg border border-surface-3 bg-surface-2 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            {error && <p className="text-xs text-red-400">Wrong password.</p>}
            <button
              type="submit"
              className="w-full rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-dim"
            >
              Enter
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-600">Play-money poker. No real TDC.</p>
        </div>
      </div>
    );
  }

  const name = playerName.trim() || "Player";

  // In a room — show the multiplayer table
  if (roomId) {
    return (
      <div>
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-wider text-brand-glow">Live table</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-100">Tide Hold&apos;em</h1>
            </div>
            <button
              onClick={() => setRoomId(null)}
              className="rounded-lg border border-surface-3 px-4 py-2 text-sm text-slate-400 hover:text-slate-100 hover:border-brand"
            >
              Leave Table
            </button>
          </div>
        </header>

        <MultiplayerTable roomId={roomId} playerName={name} />

        <nav className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link href="/">← Dashboard</Link>
          <Link href="/richlist">Richlist</Link>
        </nav>
      </div>
    );
  }

  // Lobby
  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-wider text-brand-glow">Play money</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-100">Tide Hold&apos;em</h1>
        <p className="mt-2 text-sm text-slate-400">
          Playing as <span className="text-brand-glow font-medium">{name}</span>. Join a table or create a new one.
        </p>
      </header>

      <Lobby onJoin={(id) => setRoomId(id)} />

      <nav className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link href="/">← Dashboard</Link>
        <Link href="/richlist">Richlist</Link>
      </nav>
    </div>
  );
}
