/** Player seat around the poker table. */

"use client";

import type { PlayerState } from "@/game/types";
import { Card } from "./Card";

/**
 * Seats positioned OUTSIDE the felt ellipse so they don't overlap it.
 * Coordinates are percentages of the outer container.
 */
const SEAT_POSITIONS: { top: string; left: string }[] = [
  { top: "88%", left: "50%" },   // 0: human, bottom center
  { top: "70%", left: "3%" },    // 1: bottom-left
  { top: "18%", left: "3%" },    // 2: top-left
  { top: "2%",  left: "32%" },   // 3: top center-left
  { top: "2%",  left: "68%" },   // 4: top center-right
  { top: "18%", left: "97%" },   // 5: top-right
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
  const isHuman = player.seatIndex === 0;

  const ring = player.folded
    ? "border-slate-700/50"
    : isActive
      ? "border-brand-glow ring-2 ring-brand-glow/50"
      : "border-slate-600";

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 ${player.folded ? "opacity-40" : ""}`}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className={`relative rounded-xl border ${ring} bg-surface-1/95 shadow-xl backdrop-blur-sm`}>
        {/* Dealer chip */}
        {isDealer && (
          <span className="absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-extrabold text-slate-900 shadow-md">
            D
          </span>
        )}

        {/* Name + stack */}
        <div className="px-3 pt-2 pb-1 text-center">
          <div className={`text-xs font-semibold truncate ${isHuman ? "text-brand-glow" : "text-slate-200"}`} style={{ maxWidth: 90 }}>
            {player.name}
          </div>
          <div className="text-[11px] font-mono text-yellow-400">
            {player.stack.toLocaleString()}
          </div>
        </div>

        {/* Hole cards */}
        <div className="flex justify-center gap-1 px-2 pb-2">
          {player.holeCards ? (
            player.holeCards.map((c, i) => (
              <Card key={i} card={c} size={isHuman ? "md" : "sm"} />
            ))
          ) : player.folded ? (
            <div className="h-8" />
          ) : (
            <>
              <Card faceDown size={isHuman ? "md" : "sm"} />
              <Card faceDown size={isHuman ? "md" : "sm"} />
            </>
          )}
        </div>

        {/* Bet badge */}
        {player.betSize > 0 && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-yellow-500/90 px-2.5 py-0.5 text-[10px] font-bold text-slate-900 shadow">
            {player.betSize}
          </div>
        )}

        {/* All-in */}
        {player.isAllIn && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
            ALL IN
          </div>
        )}
      </div>
    </div>
  );
}
