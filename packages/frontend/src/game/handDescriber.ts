/**
 * Converts poker-ts HandRanking enum into human-readable descriptions.
 * Also wraps pokersolver for detailed hand names like "Full House, Kings over Tens".
 */

import type { CardDisplay } from "./types";

// pokersolver is a CommonJS module with no types — minimal type shim
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Hand: any;
try {
  // Dynamic import so server-side rendering doesn't choke
  Hand = require("pokersolver").Hand;
} catch {
  Hand = null;
}

/** Map poker-ts suit names to pokersolver single-char suits. */
const SUIT_MAP: Record<string, string> = {
  spades: "s",
  hearts: "h",
  diamonds: "d",
  clubs: "c",
  s: "s",
  h: "h",
  d: "d",
  c: "c",
};

/**
 * Given a player's hole cards and the community cards, return a
 * human-readable hand description like "Full House, Kings over Tens".
 */
export function describeHand(
  holeCards: CardDisplay[],
  communityCards: CardDisplay[],
): string {
  if (!Hand) return "Unknown hand";

  const allCards = [...holeCards, ...communityCards];
  const cardStrings = allCards.map((c) => {
    const suit = SUIT_MAP[c.suit] ?? c.suit;
    return `${c.rank}${suit}`;
  });

  try {
    const solved = Hand.solve(cardStrings);
    return solved.descr ?? solved.name ?? "Unknown hand";
  } catch {
    return "Unknown hand";
  }
}

/** HandRanking enum values from poker-ts mapped to simple names. */
const RANKING_NAMES: Record<number, string> = {
  0: "High Card",
  1: "Pair",
  2: "Two Pair",
  3: "Three of a Kind",
  4: "Straight",
  5: "Flush",
  6: "Full House",
  7: "Four of a Kind",
  8: "Straight Flush",
  9: "Royal Flush",
};

export function rankingName(ranking: number): string {
  return RANKING_NAMES[ranking] ?? "Unknown";
}
