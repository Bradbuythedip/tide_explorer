/**
 * Five bot personalities for Tide Hold'em.
 *
 * Each bot evaluates hand strength against the board and combines it
 * with personality bias + randomness to pick an action. Fun and varied
 * behaviour matters more than GTO play.
 */

import type { BotPersonality, CardDisplay, PlayerAction } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PokerHand: any;
try {
  PokerHand = require("pokersolver").Hand;
} catch {
  PokerHand = null;
}

interface BotDecisionInput {
  personality: BotPersonality;
  holeCards: CardDisplay[];
  communityCards: CardDisplay[];
  legalActions: PlayerAction[];
  minBet: number;
  maxBet: number;
  potSize: number;
  stack: number;
  betToCall: number;
}

interface BotDecision {
  action: PlayerAction;
  betSize?: number;
}

/** Personality profiles: aggression, tightness, bluff frequency. */
const PROFILES: Record<BotPersonality, {
  aggressiveness: number;  // 0–1, higher = more bets/raises
  tightness: number;       // 0–1, higher = folds more weak hands
  bluffFreq: number;       // 0–1, chance to raise with weak hand
}> = {
  TAG:              { aggressiveness: 0.7, tightness: 0.7, bluffFreq: 0.15 },
  LAG:              { aggressiveness: 0.8, tightness: 0.3, bluffFreq: 0.30 },
  rock:             { aggressiveness: 0.3, tightness: 0.85, bluffFreq: 0.05 },
  "calling-station": { aggressiveness: 0.2, tightness: 0.2, bluffFreq: 0.05 },
  balanced:         { aggressiveness: 0.5, tightness: 0.5, bluffFreq: 0.15 },
};

const BOT_NAMES: Record<BotPersonality, string> = {
  TAG: "Falcon",
  LAG: "Shor",
  rock: "Grover",
  "calling-station": "Lattice",
  balanced: "Tidoshi",
};

export function botName(personality: BotPersonality): string {
  return BOT_NAMES[personality];
}

/**
 * Estimate hand strength on a 0–1 scale using pokersolver rankings.
 * 0 = garbage, 1 = royal flush.
 */
function estimateStrength(
  holeCards: CardDisplay[],
  communityCards: CardDisplay[],
): number {
  if (!PokerHand || communityCards.length === 0) {
    // Preflop: estimate from hole cards only
    return preflopStrength(holeCards);
  }

  const allCards = [...holeCards, ...communityCards].map(
    (c) => `${c.rank}${c.suit}`,
  );

  try {
    const solved = PokerHand.solve(allCards);
    // pokersolver rank is 1–10 (higher = better)
    return Math.min(1, (solved.rank ?? 1) / 10);
  } catch {
    return 0.3;
  }
}

/** Simple preflop hand strength estimator. */
function preflopStrength(holeCards: CardDisplay[]): number {
  if (holeCards.length < 2) return 0.3;
  const [a, b] = [holeCards[0]!, holeCards[1]!];
  const ranks = "23456789TJQKA";
  const ra = ranks.indexOf(a.rank);
  const rb = ranks.indexOf(b.rank);
  const high = Math.max(ra, rb);
  const low = Math.min(ra, rb);
  const paired = ra === rb;
  const suited = a.suit === b.suit;
  const gap = high - low;

  let strength = (high + low) / 24; // base from card ranks
  if (paired) strength += 0.25;
  if (suited) strength += 0.05;
  if (gap <= 1 && !paired) strength += 0.05;
  if (gap > 4) strength -= 0.1;

  return Math.max(0, Math.min(1, strength));
}

/** Add noise to a value: +-pct around the base. */
function jitter(base: number, pct: number): number {
  return base + (Math.random() - 0.5) * 2 * pct;
}

/** Main bot decision function. */
export function decideBotAction(input: BotDecisionInput): BotDecision {
  const profile = PROFILES[input.personality];
  const strength = estimateStrength(input.holeCards, input.communityCards);
  const adjusted = jitter(strength, 0.15);

  const canCheck = input.legalActions.includes("check");
  const canCall = input.legalActions.includes("call");
  const canBet = input.legalActions.includes("bet");
  const canRaise = input.legalActions.includes("raise");

  // Bluff: sometimes raise with weak hands
  if (adjusted < 0.35 && Math.random() < profile.bluffFreq && (canBet || canRaise)) {
    const bluffSize = Math.min(
      input.maxBet,
      Math.max(input.minBet, Math.round(input.potSize * (0.5 + Math.random() * 0.5))),
    );
    return { action: canBet ? "bet" : "raise", betSize: bluffSize };
  }

  // Weak hand
  if (adjusted < profile.tightness * 0.5) {
    if (canCheck) return { action: "check" };
    return { action: "fold" };
  }

  // Decent hand
  if (adjusted < 0.55) {
    if (canCheck) return { action: "check" };
    if (canCall) {
      // Calling station almost always calls
      if (input.personality === "calling-station" || Math.random() < 0.6) {
        return { action: "call" };
      }
      return { action: "fold" };
    }
    return { action: "check" };
  }

  // Strong hand
  if (adjusted < 0.75) {
    if (Math.random() < profile.aggressiveness && (canBet || canRaise)) {
      const size = Math.min(
        input.maxBet,
        Math.max(input.minBet, Math.round(input.potSize * (0.5 + Math.random() * 0.3))),
      );
      return { action: canBet ? "bet" : "raise", betSize: size };
    }
    if (canCall) return { action: "call" };
    if (canCheck) return { action: "check" };
    return { action: "fold" };
  }

  // Monster hand — bet/raise aggressively
  if (canBet || canRaise) {
    const size = Math.min(
      input.maxBet,
      Math.max(input.minBet, Math.round(input.potSize * (0.7 + Math.random() * 0.5))),
    );
    return { action: canBet ? "bet" : "raise", betSize: size };
  }
  if (canCall) return { action: "call" };
  if (canCheck) return { action: "check" };
  return { action: "fold" };
}
