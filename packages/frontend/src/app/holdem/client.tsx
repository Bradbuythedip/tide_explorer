/** Client-side wrapper that renders the PokerTable component. */

"use client";

import Link from "next/link";
import { PokerTable } from "@/components/holdem/PokerTable";

export function HoldemClient() {
  return (
    <div>
      <header className="mb-6">
        <p className="text-sm uppercase tracking-wider text-brand-glow">
          Live game
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-100">
          Tide Hold&apos;em
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-400">
          No-Limit Texas Hold&apos;em on the Tidecoin network. You vs 5 bot
          opponents. Connect a Tidecoin node to play with real TDC chip mapping.
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
