/** Player action bar: Fold, Check/Call, Raise/Bet with slider. */

"use client";

import { useState, useCallback } from "react";
import type { LegalActions, PlayerAction } from "@/game/types";

export function ActionBar({
  legalActions,
  potSize,
  onAction,
}: {
  legalActions: LegalActions | null;
  potSize: number;
  onAction: (action: PlayerAction, betSize?: number) => void;
}) {
  const [betAmount, setBetAmount] = useState(0);

  const canAct = legalActions !== null;
  const actions = legalActions?.actions ?? [];
  const minBet = legalActions?.minBet ?? 0;
  const maxBet = legalActions?.maxBet ?? 0;

  const canFold = actions.includes("fold");
  const canCheck = actions.includes("check");
  const canCall = actions.includes("call");
  const canBet = actions.includes("bet");
  const canRaise = actions.includes("raise");
  const hasSizer = canBet || canRaise;

  // Ensure betAmount is in range when legal actions change
  const clampedBet = Math.max(minBet, Math.min(maxBet, betAmount || minBet));

  const handleBetRaise = useCallback(() => {
    const action = canBet ? "bet" : "raise";
    onAction(action as PlayerAction, clampedBet);
  }, [canBet, clampedBet, onAction]);

  if (!canAct) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl bg-surface-1/90 px-6 py-4 backdrop-blur-sm">
        <span className="text-sm text-slate-500">Waiting for other players...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl bg-surface-1/90 px-6 py-4 backdrop-blur-sm">
      {/* Fold */}
      {canFold && (
        <button
          onClick={() => onAction("fold")}
          className="rounded-lg bg-red-600/80 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-600"
        >
          Fold
        </button>
      )}

      {/* Check / Call */}
      {canCheck && (
        <button
          onClick={() => onAction("check")}
          className="rounded-lg bg-emerald-600/80 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          Check
        </button>
      )}
      {canCall && (
        <button
          onClick={() => onAction("call")}
          className="rounded-lg bg-emerald-600/80 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          Call
        </button>
      )}

      {/* Bet / Raise with slider */}
      {hasSizer && (
        <div className="flex items-center gap-2">
          {/* Presets */}
          <div className="flex gap-1">
            <button
              onClick={() => setBetAmount(Math.min(maxBet, Math.max(minBet, Math.round(potSize * 0.5))))}
              className="rounded bg-surface-3 px-2 py-1 text-xs text-slate-300 transition hover:bg-surface-2"
            >
              ½ Pot
            </button>
            <button
              onClick={() => setBetAmount(Math.min(maxBet, Math.max(minBet, potSize)))}
              className="rounded bg-surface-3 px-2 py-1 text-xs text-slate-300 transition hover:bg-surface-2"
            >
              Pot
            </button>
            <button
              onClick={() => setBetAmount(maxBet)}
              className="rounded bg-surface-3 px-2 py-1 text-xs text-slate-300 transition hover:bg-surface-2"
            >
              All-In
            </button>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={minBet}
            max={maxBet}
            value={clampedBet}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            className="w-24 accent-brand"
          />

          {/* Amount display */}
          <span className="min-w-[4rem] text-center font-mono text-sm text-brand-glow">
            {clampedBet.toLocaleString()}
          </span>

          {/* Bet/Raise button */}
          <button
            onClick={handleBetRaise}
            className="rounded-lg bg-blue-600/80 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            {canBet ? "Bet" : "Raise"}
          </button>
        </div>
      )}
    </div>
  );
}
