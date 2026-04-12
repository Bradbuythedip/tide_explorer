/** Cryptographically secure Fisher-Yates shuffle for card dealing. */

import type { CardStr, Rank, Suit } from "./types";

const RANKS: Rank[] = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const SUITS: Suit[] = ["s","h","d","c"];

/** Build a standard 52-card deck. */
export function buildDeck(): CardStr[] {
  const deck: CardStr[] = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push(`${r}${s}` as CardStr);
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle using crypto.getRandomValues().
 * Never uses Math.random(). Returns a new array.
 */
export function secureShuffle(deck: CardStr[]): CardStr[] {
  const arr = [...deck];
  const rand = new Uint32Array(arr.length);
  crypto.getRandomValues(rand);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand[i]! % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
