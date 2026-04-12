/** Core types for Tide Hold'em game logic. No React imports here. */

export type Suit = "s" | "h" | "d" | "c";
export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "T" | "J" | "Q" | "K" | "A";

/** Card as a two-char string: rank + suit, e.g. "As", "Th", "2c". */
export type CardStr = `${Rank}${Suit}`;

export interface CardDisplay {
  rank: Rank;
  suit: Suit;
  str: CardStr;
}

export type GamePhase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "hand_complete";

export type PlayerAction = "fold" | "check" | "call" | "bet" | "raise";

export interface PlayerState {
  seatIndex: number;
  name: string;
  stack: number;
  betSize: number;
  totalChips: number;
  holeCards: CardDisplay[] | null;
  folded: boolean;
  isBot: boolean;
  personality?: BotPersonality;
  isAllIn: boolean;
}

export type BotPersonality = "TAG" | "LAG" | "rock" | "calling-station" | "balanced";

export interface PotInfo {
  size: number;
  eligiblePlayers: number[];
}

export interface LegalActions {
  actions: PlayerAction[];
  minBet?: number;
  maxBet?: number;
}

export interface HandResult {
  winners: WinnerInfo[];
  potSize: number;
}

export interface WinnerInfo {
  seatIndex: number;
  playerName: string;
  handDescription: string;
  amount: number;
}

export interface GameState {
  phase: GamePhase;
  players: PlayerState[];
  communityCards: CardDisplay[];
  pots: PotInfo[];
  dealerSeat: number;
  playerToAct: number;
  legalActions: LegalActions | null;
  handResult: HandResult | null;
  handNumber: number;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  s: "\u2660",
  h: "\u2665",
  d: "\u2666",
  c: "\u2663",
};

export const SUIT_NAMES: Record<Suit, string> = {
  s: "spades",
  h: "hearts",
  d: "diamonds",
  c: "clubs",
};

export const RANK_DISPLAY: Record<Rank, string> = {
  "2": "2", "3": "3", "4": "4", "5": "5",
  "6": "6", "7": "7", "8": "8", "9": "9",
  T: "10", J: "J", Q: "Q", K: "K", A: "A",
};
