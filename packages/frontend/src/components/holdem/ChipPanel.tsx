/** Play-money chip panel — no node connection, just fake chips. */

"use client";

export function ChipPanel({
  chipStack,
  handsPlayed,
  onRebuy,
}: {
  chipStack: number;
  handsPlayed: number;
  onRebuy: () => void;
}) {
  return (
    <div className="rounded-xl border border-surface-3 bg-surface-1/95 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand" />
        <span className="text-xs font-medium text-slate-300">
          Play Money
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-xs text-slate-500">Chip Stack</div>
          <div className="font-mono text-lg font-semibold text-yellow-400">
            {chipStack.toLocaleString()}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">Hands Played</div>
          <div className="font-mono text-sm text-slate-300">
            {handsPlayed}
          </div>
        </div>

        {chipStack <= 0 && (
          <button
            onClick={onRebuy}
            className="w-full rounded bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand-dim"
          >
            Re-buy 1,000
          </button>
        )}

        <div className="border-t border-surface-3 pt-3 mt-3">
          <div className="text-xs text-slate-600 leading-relaxed">
            No real TDC at stake. Just practice
            your game against the bots.
          </div>
        </div>
      </div>
    </div>
  );
}
