/** Player seat around the poker table. */

"use client";

import type { PlayerState } from "@/game/types";
import { Card } from "./Card";

/** Seat positions around an elliptical table (percentage-based). */
const SEAT_POSITIONS: { top: string; left: string }[] = [
  { top: "82%", left: "50%" },  // 0: human, bottom center
  { top: "65%", left: "10%" },  // 1: bottom left
  { top: "20%", left: "5%" },   // 2: top left
  { top: "5%", left: "35%" },   // 3: top center-left
  { top: "5%", left: "65%" },   // 4: top center-right
  { top: "20%", left: "95%" },  // 5: top right
];

export function Seat({
  player,
  isActive,
  isDealer,
}: {
  player: PlayerState;
  isActive: boolean;
  isDealer: boolean;
}) {
  const pos = SEAT_POSITIONS[player.seatIndex] ?? SEAT_POSITIONS[0]!;

  const borderColor = player.folded
    ? "border-slate-700"
    : isActive
      ? "border-brand-glow ring-2 ring-brand-glow/40"
      : "border-slate-500";

  const opacity = player.folded ? "opacity-50" : "";

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${opacity}`}
      style={{ top: pos.top, left: pos.left }}
    >
      <div
        className={`relative rounded-xl border ${borderColor} bg-surface-1/95 px-3 py-2 shadow-lg backdrop-blur-sm`}
      >
        {/* Dealer button */}
        {isDealer && (
          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-slate-900 shadow">
            D
          </span>
        )}

        {/* Player name and stack */}
        <div className="mb-1 text-center">
          <div className="text-xs font-medium text-slate-200 truncate max-w-[80px]">
            {player.name}
          </div>
          <div className="text-xs text-brand-glow font-mono">
            {player.stack.toLocaleString()}
          </div>
        </div>

        {/* Hole cards */}
        <div className="flex justify-center gap-0.5">
          {player.holeCards ? (
            player.holeCards.map((c, i) => (
              <Card key={i} card={c} />
            ))
          ) : player.folded ? null : (
            <>
              <Card faceDown />
              <Card faceDown />
            </>
          )}
        </div>

        {/* Current bet */}
        {player.betSize > 0 && (
          <div className="mt-1 text-center text-xs text-yellow-400 font-mono">
            Bet: {player.betSize}
          </div>
        )}

        {/* All-in indicator */}
        {player.isAllIn && (
          <div className="mt-0.5 text-center text-xs font-bold text-red-400">
            ALL IN
          </div>
        )}
      </div>
    </div>
  );
}
