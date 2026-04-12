/**
 * Wraps poker-ts Table to drive the full hand lifecycle.
 *
 * The human is always seat 0. Bots occupy seats 1–5.
 * All game logic is pure TypeScript with no React imports.
 */

import { Table } from "poker-ts";
import type {
  BotPersonality,
  CardDisplay,
  CardStr,
  GamePhase,
  GameState,
  HandResult,
  LegalActions,
  PlayerAction,
  PlayerState,
  Rank,
  Suit,
  WinnerInfo,
} from "./types";
import { buildDeck, secureShuffle } from "./shuffle";
import { decideBotAction, botName } from "./botAI";
import { describeHand } from "./handDescriber";

const NUM_SEATS = 6;
const SMALL_BLIND = 5;
const BIG_BLIND = 10;
const DEFAULT_BUY_IN = 1000;

const BOT_PERSONALITIES: BotPersonality[] = [
  "TAG", "LAG", "rock", "calling-station", "balanced",
];

function parseCard(s: CardStr): CardDisplay {
  return { rank: s[0] as Rank, suit: s[1] as Suit, str: s };
}

export type GameEventCallback = (state: GameState) => void;

// Helpers to safely query poker-ts state without triggering asserts.
function safeIsHandInProgress(table: InstanceType<typeof Table>): boolean {
  try { return table.isHandInProgress(); } catch { return false; }
}
function safeIsBettingRoundInProgress(table: InstanceType<typeof Table>): boolean {
  try { return table.isBettingRoundInProgress(); } catch { return false; }
}

export class GameManager {
  private table: InstanceType<typeof Table>;
  private playerNames: string[] = [];
  private botPersonalities: (BotPersonality | null)[] = [];
  private foldedSeats: Set<number> = new Set();
  private handNumber = 0;
  private handResult: HandResult | null = null;
  private phase: GamePhase = "waiting";
  private onUpdate: GameEventCallback | null = null;
  private _shuffledDeck: CardStr[] = [];
  private _dealIndex = 0;
  private _holeCards: (CardDisplay[] | null)[] = [];
  private _communityCards: CardDisplay[] = [];
  private _bustedSeats: Set<number> = new Set();
  private _pumpGeneration = 0;

  constructor() {
    this.table = new Table(
      { smallBlind: SMALL_BLIND, bigBlind: BIG_BLIND },
      NUM_SEATS,
    );
  }

  setOnUpdate(cb: GameEventCallback) {
    this.onUpdate = cb;
  }

  initialize(humanName: string, buyIn: number = DEFAULT_BUY_IN) {
    this.playerNames = [humanName];
    this.botPersonalities = [null];

    for (let i = 0; i < 5; i++) {
      const personality = BOT_PERSONALITIES[i]!;
      this.playerNames.push(botName(personality));
      this.botPersonalities.push(personality);
    }

    for (let i = 0; i < NUM_SEATS; i++) {
      this.table.sitDown(i, buyIn);
    }

    this.phase = "waiting";
    this.emitState();
  }

  startHand() {
    const seats = this.table.seats();
    for (let i = 1; i < NUM_SEATS; i++) {
      if (this._bustedSeats.has(i)) {
        this.table.sitDown(i, DEFAULT_BUY_IN);
        this._bustedSeats.delete(i);
      }
    }

    if (this._bustedSeats.has(0)) return;

    this._shuffledDeck = secureShuffle(buildDeck());
    this._dealIndex = 0;
    this._holeCards = new Array(NUM_SEATS).fill(null);
    this._communityCards = [];
    this.foldedSeats.clear();
    this.handResult = null;
    this.handNumber++;

    this.table.startHand();
    this.phase = "preflop";

    for (let i = 0; i < NUM_SEATS; i++) {
      if (seats[i] !== null && !this._bustedSeats.has(i)) {
        this._holeCards[i] = [
          parseCard(this._shuffledDeck[this._dealIndex++]!),
          parseCard(this._shuffledDeck[this._dealIndex++]!),
        ];
      }
    }

    this.emitState();
    this.pump();
  }

  humanAction(action: PlayerAction, betSize?: number) {
    if (this.phase === "waiting" || this.phase === "hand_complete" || this.phase === "showdown") return;
    if (!safeIsHandInProgress(this.table) || !safeIsBettingRoundInProgress(this.table)) return;

    try {
      if (this.table.playerToAct() !== 0) return;
      this.table.actionTaken(action, betSize);
      if (action === "fold") this.foldedSeats.add(0);
    } catch (e) {
      console.error("[GameManager] humanAction error:", e);
      return;
    }

    this.emitState();
    this.pump();
  }

  private pump() {
    const gen = ++this._pumpGeneration;
    setTimeout(() => this.pumpLoop(gen), 10);
  }

  private async pumpLoop(gen: number) {
    const MAX_ITERS = 200;

    for (let i = 0; i < MAX_ITERS; i++) {
      if (gen !== this._pumpGeneration) return;

      // Hand ended (e.g. everyone folded) — finish up.
      if (!safeIsHandInProgress(this.table)) {
        this.finishHand();
        return;
      }

      // Betting round in progress — run next action.
      if (safeIsBettingRoundInProgress(this.table)) {
        let pta: number;
        try { pta = this.table.playerToAct(); } catch { this.finishHand(); return; }

        if (pta === 0) {
          // Human's turn.
          this.emitState();
          return;
        }

        // Bot delay for visual pacing.
        await delay(350 + Math.random() * 250);
        if (gen !== this._pumpGeneration) return;

        // Re-check: hand may have resolved or round may have ended.
        if (!safeIsHandInProgress(this.table)) { this.finishHand(); return; }
        if (!safeIsBettingRoundInProgress(this.table)) { /* fall through to advance */ }
        else {
          this.executeBotAction(this.table.playerToAct());
          this.emitState();

          // Bot action may have ended the hand (everyone folded).
          if (!safeIsHandInProgress(this.table)) { this.finishHand(); return; }
          continue;
        }
      }

      // Betting round is over — advance to next street or showdown.
      try {
        this.table.endBettingRound();
      } catch {
        // endBettingRound can fail if already completed or hand ended.
        this.finishHand();
        return;
      }

      // Check if all rounds are done.
      let allDone = false;
      try { allDone = this.table.areBettingRoundsCompleted(); } catch { allDone = true; }

      if (allDone) {
        try { this.table.showdown(); } catch { /* may already be resolved */ }
        this.finishHand();
        return;
      }

      // Deal community cards for the new street.
      this.dealStreetCards();
      this.emitState();
    }

    // Safety: if we exhausted iterations, force finish.
    console.error("[GameManager] pumpLoop exhausted iterations");
    this.finishHand();
  }

  /**
   * Resolve the hand regardless of how it ended (showdown, fold-out, error).
   * Reads winners from poker-ts if available, otherwise names the last
   * player standing.
   */
  private finishHand() {
    if (this.phase === "hand_complete") return; // Already finished.
    this.phase = "showdown";

    // Try to read winners from poker-ts.
    let rawWinners: unknown[][][] = [];
    try { rawWinners = this.table.winners() as unknown[][][]; } catch { /* no winners data */ }

    const winners: WinnerInfo[] = [];

    if (rawWinners.length > 0) {
      for (const pot of rawWinners) {
        for (const wg of pot) {
          const idx = wg[0] as number;
          const holeCards = this._holeCards[idx];
          let handDesc = "Winner";

          if (holeCards && this._communityCards.length >= 5) {
            handDesc = describeHand(holeCards, this._communityCards);
          } else if (wg[1] && typeof wg[1] === "object" && "ranking" in (wg[1] as Record<string, unknown>)) {
            const rankNames = [
              "High Card", "Pair", "Two Pair", "Three of a Kind",
              "Straight", "Flush", "Full House", "Four of a Kind",
              "Straight Flush", "Royal Flush",
            ];
            handDesc = rankNames[(wg[1] as { ranking: number }).ranking] ?? "Winner";
          }

          winners.push({
            seatIndex: idx,
            playerName: this.playerNames[idx] ?? `Seat ${idx}`,
            handDescription: handDesc,
            amount: 0,
          });
        }
      }
    }

    // Fallback: if no winners found, find the last non-folded player.
    if (winners.length === 0) {
      for (let i = 0; i < NUM_SEATS; i++) {
        if (!this.foldedSeats.has(i) && !this._bustedSeats.has(i)) {
          winners.push({
            seatIndex: i,
            playerName: this.playerNames[i] ?? `Seat ${i}`,
            handDescription: "Last player standing",
            amount: 0,
          });
          break;
        }
      }
    }

    let totalPot = 0;
    try { totalPot = this.table.pots().reduce((s, p) => s + p.size, 0); } catch { /* no pots */ }

    this.handResult = { winners, potSize: totalPot };

    // Mark busted players.
    const seats = this.table.seats();
    for (let i = 0; i < NUM_SEATS; i++) {
      const s = seats[i];
      if (s !== null && s.totalChips <= 0) {
        this._bustedSeats.add(i);
        try { this.table.standUp(i); } catch { /* already standing */ }
      }
    }

    this.phase = "hand_complete";
    this.emitState();
  }

  private executeBotAction(seatIndex: number) {
    const personality = this.botPersonalities[seatIndex];
    if (!personality) return;

    let la;
    try { la = this.table.legalActions(); } catch { return; }

    const holeCards = this._holeCards[seatIndex] ?? [];
    let potSize = 0;
    try { potSize = this.table.pots().reduce((sum, p) => sum + p.size, 0); } catch { /* 0 */ }
    let seat: { stack: number; betSize: number } | null = null;
    try { seat = this.table.handPlayers()[seatIndex]; } catch { /* null */ }

    const decision = decideBotAction({
      personality,
      holeCards,
      communityCards: this._communityCards,
      legalActions: la.actions as PlayerAction[],
      minBet: la.chipRange?.min ?? 0,
      maxBet: la.chipRange?.max ?? 0,
      potSize,
      stack: seat?.stack ?? 0,
      betToCall: seat?.betSize ?? 0,
    });

    try {
      this.table.actionTaken(decision.action, decision.betSize);
      if (decision.action === "fold") this.foldedSeats.add(seatIndex);
      return;
    } catch { /* primary failed */ }

    for (const fb of ["check", "call", "fold"] as PlayerAction[]) {
      if (la.actions.includes(fb)) {
        try {
          this.table.actionTaken(fb);
          if (fb === "fold") this.foldedSeats.add(seatIndex);
          return;
        } catch { /* try next */ }
      }
    }
  }

  private dealStreetCards() {
    let round: string;
    try { round = this.table.roundOfBetting(); } catch { return; }

    if (round === "flop") {
      this.phase = "flop";
      this._dealIndex++;
      for (let i = 0; i < 3; i++) {
        this._communityCards.push(parseCard(this._shuffledDeck[this._dealIndex++]!));
      }
    } else if (round === "turn") {
      this.phase = "turn";
      this._dealIndex++;
      this._communityCards.push(parseCard(this._shuffledDeck[this._dealIndex++]!));
    } else if (round === "river") {
      this.phase = "river";
      this._dealIndex++;
      this._communityCards.push(parseCard(this._shuffledDeck[this._dealIndex++]!));
    }
  }

  getState(): GameState {
    const seats = this.table.seats();
    const handInProgress = safeIsHandInProgress(this.table);
    const bettingInProgress = handInProgress && safeIsBettingRoundInProgress(this.table);

    let handPlayers: ({ totalChips: number; stack: number; betSize: number } | null)[] | null = null;
    let pots: { size: number; eligiblePlayers: number[] }[] = [];
    if (handInProgress) {
      try { handPlayers = this.table.handPlayers(); } catch { /* null */ }
      try { pots = this.table.pots(); } catch { /* [] */ }
    }

    const players: PlayerState[] = [];
    for (let i = 0; i < NUM_SEATS; i++) {
      const seat = seats[i];
      if (seat === null && !this._bustedSeats.has(i)) {
        players.push({
          seatIndex: i, name: this.playerNames[i] ?? `Player ${i}`,
          stack: 0, betSize: 0, totalChips: 0,
          holeCards: null, folded: true, isBot: i !== 0,
          personality: this.botPersonalities[i] ?? undefined, isAllIn: false,
        });
        continue;
      }

      const hp = handPlayers?.[i];
      const s = hp ?? seat;
      const isInHand = hp !== null && hp !== undefined;
      const folded = this.foldedSeats.has(i) || (!isInHand && handInProgress);

      let visibleCards: CardDisplay[] | null = null;
      if (this._holeCards[i]) {
        if (i === 0 || this.phase === "showdown" || this.phase === "hand_complete") {
          if (!folded || i === 0) visibleCards = this._holeCards[i];
        }
      }

      players.push({
        seatIndex: i, name: this.playerNames[i] ?? `Player ${i}`,
        stack: s?.stack ?? 0, betSize: s?.betSize ?? 0, totalChips: s?.totalChips ?? 0,
        holeCards: visibleCards, folded, isBot: i !== 0,
        personality: this.botPersonalities[i] ?? undefined,
        isAllIn: (s?.stack ?? 0) === 0 && !folded && isInHand,
      });
    }

    let legalActions: LegalActions | null = null;
    if (bettingInProgress) {
      try {
        if (this.table.playerToAct() === 0) {
          const la = this.table.legalActions();
          legalActions = {
            actions: la.actions as PlayerAction[],
            minBet: la.chipRange?.min,
            maxBet: la.chipRange?.max,
          };
        }
      } catch { /* not player's turn */ }
    }

    let playerToAct = -1;
    if (bettingInProgress) {
      try { playerToAct = this.table.playerToAct(); } catch { /* -1 */ }
    }

    let dealerSeat = 0;
    if (handInProgress) {
      try { dealerSeat = this.table.button(); } catch { /* 0 */ }
    }

    return {
      phase: this.phase, players,
      communityCards: this._communityCards,
      pots: pots.map((p) => ({ size: p.size, eligiblePlayers: p.eligiblePlayers })),
      dealerSeat, playerToAct, legalActions,
      handResult: this.handResult, handNumber: this.handNumber,
    };
  }

  private emitState() {
    if (this.onUpdate) this.onUpdate(this.getState());
  }

  isHumanBusted(): boolean { return this._bustedSeats.has(0); }

  getHumanStack(): number { return this.table.seats()[0]?.totalChips ?? 0; }

  humanRebuy(amount: number) {
    if (this._bustedSeats.has(0)) {
      this.table.sitDown(0, amount);
      this._bustedSeats.delete(0);
      this.emitState();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
