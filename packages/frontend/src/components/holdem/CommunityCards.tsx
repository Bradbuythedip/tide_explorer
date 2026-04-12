/** Five community card slots in the center of the table. */

"use client";

import type { CardDisplay } from "@/game/types";
import { Card } from "./Card";

export function CommunityCards({ cards }: { cards: CardDisplay[] }) {
  const slots = 5;

  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: slots }).map((_, i) => (
        <div key={i} className="transition-all duration-300">
          {cards[i] ? (
            <Card card={cards[i]} />
          ) : (
            <div className="h-16 w-11 rounded-md border border-dashed border-emerald-900/50" />
          )}
        </div>
      ))}
    </div>
  );
}
