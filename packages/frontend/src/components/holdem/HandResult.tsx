/** Showdown result overlay showing winner(s) and hand description. */

"use client";

import type { HandResult as HandResultType } from "@/game/types";

export function HandResultOverlay({
  result,
  onNextHand,
  humanBusted,
}: {
  result: HandResultType;
  onNextHand: () => void;
  humanBusted: boolean;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-0/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-surface-3 bg-surface-1 p-6 shadow-2xl">
        <h3 className="text-center text-lg font-semibold text-brand-glow">
          Showdown
        </h3>

        <div className="mt-4 space-y-2">
          {result.winners.map((w, i) => (
            <div
              key={i}
              className="rounded-lg border border-threat-safe/30 bg-threat-safe/5 p-3"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-medium text-slate-100">{w.playerName}</span>
                <span className="text-xs text-threat-safe">Winner</span>
              </div>
              <div className="mt-1 text-sm text-slate-400">
                {w.handDescription}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 text-center text-xs text-slate-500">
          Total pot: {result.potSize.toLocaleString()} chips
        </div>

        {humanBusted ? (
          <div className="mt-4 text-center">
            <p className="text-sm text-red-400 mb-3">You&apos;re out of chips!</p>
            <button
              onClick={onNextHand}
              className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-dim"
            >
              Re-buy &amp; Continue
            </button>
          </div>
        ) : (
          <button
            onClick={onNextHand}
            className="mt-4 w-full rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-dim"
          >
            Next Hand
          </button>
        )}
      </div>
    </div>
  );
}
