/** Single playing card — face or back. */

"use client";

import type { CardDisplay } from "@/game/types";
import { RANK_DISPLAY, SUIT_SYMBOLS } from "@/game/types";

export function Card({ card, faceDown }: { card?: CardDisplay | null; faceDown?: boolean }) {
  if (!card || faceDown) {
    return (
      <div className="flex h-16 w-11 items-center justify-center rounded-md border border-slate-600 bg-gradient-to-br from-slate-700 to-slate-800 shadow-md">
        <span className="text-lg text-slate-500">?</span>
      </div>
    );
  }

  const isRed = card.suit === "h" || card.suit === "d";

  return (
    <div className="flex h-16 w-11 flex-col items-center justify-between rounded-md border border-slate-300 bg-white p-1 shadow-md">
      <span className={`text-xs font-bold leading-none ${isRed ? "text-red-600" : "text-slate-900"}`}>
        {RANK_DISPLAY[card.rank]}
      </span>
      <span className={`text-lg leading-none ${isRed ? "text-red-600" : "text-slate-900"}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </div>
  );
}
