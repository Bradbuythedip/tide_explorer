/** Pot display centered above the community cards. */

"use client";

import type { PotInfo } from "@/game/types";

export function PotDisplay({ pots }: { pots: PotInfo[] }) {
  const total = pots.reduce((s, p) => s + p.size, 0);
  if (total === 0) return null;

  return (
    <div className="text-center">
      <div className="inline-block rounded-lg bg-surface-0/80 px-4 py-1.5 backdrop-blur-sm">
        <span className="text-sm font-medium text-slate-300">Pot: </span>
        <span className="font-mono text-sm font-bold text-yellow-400">
          {total.toLocaleString()}
        </span>
      </div>
      {pots.length > 1 && (
        <div className="mt-1 flex justify-center gap-2">
          {pots.map((p, i) => (
            <span key={i} className="text-xs text-slate-500">
              {i === 0 ? "Main" : `Side ${i}`}: {p.size.toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
