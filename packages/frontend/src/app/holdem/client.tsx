/** Client-side wrapper: password gate + PokerTable. */

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { PokerTable } from "@/components/holdem/PokerTable";

const PASSWORD = "tidoshi";

export function HoldemClient() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = useCallback(
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

  if (!authed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm rounded-xl border border-surface-3 bg-surface-1 p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold text-slate-100">
            Tide Hold&apos;em
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter the password to sit down at the table.
          </p>

          <form onSubmit={handleSubmit} className="mt-6">
            <input
              type="password"
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setError(false);
              }}
              placeholder="Password"
              autoFocus
              className="w-full rounded-lg border border-surface-3 bg-surface-2 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            {error && (
              <p className="mt-2 text-xs text-red-400">
                Wrong password. Try again.
              </p>
            )}
            <button
              type="submit"
              className="mt-4 w-full rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-dim"
            >
              Enter
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">
            Play-money poker. No real TDC at stake.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-wider text-brand-glow">
          Play money
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-100">
          Tide Hold&apos;em
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-400">
          No-Limit Texas Hold&apos;em. You vs 5 bot opponents.
          Play chips only — no real TDC at stake.
        </p>
      </header>

      <PokerTable />

      <nav className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link href="/">← Dashboard</Link>
        <Link href="/richlist">Richlist</Link>
        <Link href="/genesis">Genesis</Link>
      </nav>
    </div>
  );
}
