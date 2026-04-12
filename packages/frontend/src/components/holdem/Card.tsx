/** Single playing card — face or back. */

"use client";

import type { CardDisplay } from "@/game/types";
import { RANK_DISPLAY, SUIT_SYMBOLS } from "@/game/types";

export function Card({
  card,
  faceDown,
  size = "md",
}: {
  card?: CardDisplay | null;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: "h-12 w-8 text-[10px]",
    md: "h-[72px] w-[50px] text-sm",
    lg: "h-24 w-16 text-lg",
  }[size];

  const suitSize = {
    sm: "text-sm",
    md: "text-xl",
    lg: "text-2xl",
  }[size];

  if (!card || faceDown) {
    return (
      <div
        className={`${dims} flex items-center justify-center rounded-lg border border-slate-600 bg-gradient-to-br from-indigo-900 to-slate-800 shadow-lg`}
      >
        <div className="text-indigo-400/40 text-lg font-bold">T</div>
      </div>
    );
  }

  const isRed = card.suit === "h" || card.suit === "d";
  const color = isRed ? "text-red-500" : "text-slate-900";

  return (
    <div
      className={`${dims} flex flex-col items-center justify-between rounded-lg border border-slate-200 bg-white p-1 shadow-lg`}
    >
      <span className={`font-bold leading-none ${color}`}>
        {RANK_DISPLAY[card.rank]}
      </span>
      <span className={`${suitSize} leading-none ${color}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </div>
  );
}
