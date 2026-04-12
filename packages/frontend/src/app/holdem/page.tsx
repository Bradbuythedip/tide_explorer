import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tide Hold'em",
  description:
    "Texas Hold'em poker on the Tidecoin network. Play with TDC.",
};

/**
 * Tide Hold'em — Texas Hold'em with Tidecoin.
 *
 * This is the skeleton page. The game client, table logic, and
 * WebSocket rooms will be built here. See HOLDEM.md (to be created)
 * for the full design.
 *
 * Architecture notes for implementation:
 *   - Game state lives on the backend (authoritative dealer).
 *   - Frontend is a "use client" component that connects via WS.
 *   - Each table is a room on the WsHub (needs per-room isolation).
 *   - Cards are dealt server-side; only the player's own hole cards
 *     are sent to their socket. Community cards broadcast to all.
 *   - Betting actions (fold, check, call, raise) are WS messages
 *     validated server-side against the current game state.
 *   - Buy-in / cash-out tracked in TDC satoshis (bigint).
 */
export default function HoldemPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-12">
        <p className="text-sm uppercase tracking-wider text-brand-glow">
          Coming soon
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-100">
          Tide Hold&apos;em
        </h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Texas Hold&apos;em poker on the Tidecoin network. Sit down at a
          table, buy in with TDC, and play. Post-quantum cards dealt by
          a provably fair dealer.
        </p>
      </header>

      <section className="rounded-xl border border-surface-3 bg-surface-1 p-10 text-center">
        <div className="text-6xl">{"🂠"}</div>
        <h2 className="mt-6 text-xl font-semibold text-slate-100">
          Table is being set up
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
          Tide Hold&apos;em is under active development. The table, cards,
          and real-time multiplayer will appear here soon.
        </p>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/">← Dashboard</Link>
        <span className="mx-3 text-slate-600">·</span>
        <Link href="/richlist">Richlist</Link>
        <span className="mx-3 text-slate-600">·</span>
        <Link href="/genesis">Genesis</Link>
      </p>
    </main>
  );
}
