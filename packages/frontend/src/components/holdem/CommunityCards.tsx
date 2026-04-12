/** Five community card slots in the center of the table. */

"use client";

import type { CardDisplay } from "@/game/types";
import { Card } from "./Card";

export function CommunityCards({ cards }: { cards: CardDisplay[] }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i}>
          {cards[i] ? (
            <Card card={cards[i]} size="md" />
          ) : (
            <div className="h-[72px] w-[50px] rounded-lg border border-dashed border-emerald-700/40" />
          )}
        </div>
      ))}
    </div>
  );
}
