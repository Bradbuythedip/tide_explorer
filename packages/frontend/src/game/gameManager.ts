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
  /** Guard against overlapping bot loops. */
  private _botLoopRunning = false;

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
    if (!this.table.isHandInProgress() || !this.table.isBettingRoundInProgress()) return;

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

  /**
   * Central state-machine driver. Call after any state change.
   *
   * Schedules the async pump loop via setTimeout(0) so it always
   * starts on a fresh call stack. This avoids a microtask race where
   * humanAction() calls pump() before a previous pumpLoop's .finally()
   * has cleared the _botLoopRunning flag.
   */
  private pump() {
    // Use setTimeout to guarantee the previous loop's .finally() has
    // settled before we check the guard flag.
    setTimeout(() => this.startPumpIfIdle(), 0);
  }

  private startPumpIfIdle() {
    if (this._botLoopRunning) return;
    this._botLoopRunning = true;
    this.pumpLoop().finally(() => {
      this._botLoopRunning = false;
    });
  }

  private async pumpLoop() {
    const MAX_ITERS = 200;
    let iters = 0;

    while (this.table.isHandInProgress() && iters++ < MAX_ITERS) {

      // ---- Betting round in progress ----
      if (this.table.isBettingRoundInProgress()) {
        const pta = this.table.playerToAct();
        if (pta === 0) {
          // Human's turn — stop and wait for humanAction()
          this.emitState();
          return;
        }

        // Bot's turn
        await delay(350 + Math.random() * 250);

        // Re-check state: human might have acted during the delay
        // (shouldn't happen, but be defensive)
        if (!this.table.isHandInProgress() || !this.table.isBettingRoundInProgress()) break;
        if (this.table.playerToAct() !== pta) continue;

        this.executeBotAction(pta);
        this.emitState();
        continue;
      }

      // ---- Betting round finished ----
      if (this.table.areBettingRoundsCompleted()) {
        this.doShowdown();
        return;
      }

      // Deal next street
      this.dealNextStreet();
      this.emitState();
    }

    if (iters >= MAX_ITERS) {
      console.error("[GameManager] pumpLoop hit iteration limit — forcing showdown");
      try { this.doShowdown(); } catch { /* fallback */ }
    }
  }

  private executeBotAction(seatIndex: number) {
    const personality = this.botPersonalities[seatIndex];
    if (!personality) return;

    let la;
    try {
      la = this.table.legalActions();
    } catch {
      return;
    }

    const holeCards = this._holeCards[seatIndex] ?? [];
    const pots = this.table.pots();
    const potSize = pots.reduce((sum, p) => sum + p.size, 0);
    const seat = this.table.handPlayers()[seatIndex];

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
    } catch { /* primary action failed, try fallbacks */ }

    // Fallback: pick the simplest legal action
    const fallbacks: PlayerAction[] = ["check", "call", "fold"];
    for (const fb of fallbacks) {
      if (la.actions.includes(fb)) {
        try {
          this.table.actionTaken(fb);
          if (fb === "fold") this.foldedSeats.add(seatIndex);
          return;
        } catch { /* try next */ }
      }
    }
  }

  private dealNextStreet() {
    this.table.endBettingRound();

    const round = this.table.roundOfBetting();
    if (round === "flop") {
      this.phase = "flop";
      this._dealIndex++; // burn
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

  private doShowdown() {
    this.phase = "showdown";
    this.table.showdown();

    const winnersData = this.table.winners();
    const winners: WinnerInfo[] = [];

    for (const pot of winnersData) {
      for (const winnerGroup of pot) {
        const [seatIndex, handInfo] = winnerGroup;
        const idx = seatIndex as number;
        const holeCards = this._holeCards[idx];
        let handDesc = "Unknown hand";

        if (holeCards && this._communityCards.length > 0) {
          handDesc = describeHand(holeCards, this._communityCards);
        } else if (handInfo && typeof handInfo === "object" && "ranking" in handInfo) {
          const rankNames = [
            "High Card", "Pair", "Two Pair", "Three of a Kind",
            "Straight", "Flush", "Full House", "Four of a Kind",
            "Straight Flush", "Royal Flush",
          ];
          handDesc = rankNames[(handInfo as { ranking: number }).ranking] ?? "Unknown";
        }

        winners.push({
          seatIndex: idx,
          playerName: this.playerNames[idx] ?? `Seat ${idx}`,
          handDescription: handDesc,
          amount: 0,
        });
      }
    }

    const pots = this.table.pots();
    const totalPot = pots.reduce((s, p) => s + p.size, 0);

    this.handResult = { winners, potSize: totalPot };

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

  getState(): GameState {
    const seats = this.table.seats();
    const handPlayers = this.table.isHandInProgress() ? this.table.handPlayers() : null;
    const pots = this.table.isHandInProgress() ? this.table.pots() : [];

    const players: PlayerState[] = [];
    for (let i = 0; i < NUM_SEATS; i++) {
      const seat = seats[i];
      if (seat === null && !this._bustedSeats.has(i)) {
        players.push({
          seatIndex: i,
          name: this.playerNames[i] ?? `Player ${i}`,
          stack: 0, betSize: 0, totalChips: 0,
          holeCards: null, folded: true,
          isBot: i !== 0,
          personality: this.botPersonalities[i] ?? undefined,
          isAllIn: false,
        });
        continue;
      }

      const hp = handPlayers?.[i];
      const s = hp ?? seat;
      const isInHand = hp !== null && hp !== undefined;
      const folded = this.foldedSeats.has(i) || (!isInHand && this.table.isHandInProgress());

      let visibleCards: CardDisplay[] | null = null;
      if (this._holeCards[i]) {
        if (i === 0 || this.phase === "showdown" || this.phase === "hand_complete") {
          if (!folded || i === 0) {
            visibleCards = this._holeCards[i];
          }
        }
      }

      players.push({
        seatIndex: i,
        name: this.playerNames[i] ?? `Player ${i}`,
        stack: s?.stack ?? 0,
        betSize: s?.betSize ?? 0,
        totalChips: s?.totalChips ?? 0,
        holeCards: visibleCards,
        folded,
        isBot: i !== 0,
        personality: this.botPersonalities[i] ?? undefined,
        isAllIn: (s?.stack ?? 0) === 0 && !folded && isInHand,
      });
    }

    let legalActions: LegalActions | null = null;
    if (this.table.isHandInProgress() && this.table.isBettingRoundInProgress()) {
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

    return {
      phase: this.phase,
      players,
      communityCards: this._communityCards,
      pots: pots.map((p) => ({ size: p.size, eligiblePlayers: p.eligiblePlayers })),
      dealerSeat: this.table.isHandInProgress() ? this.table.button() : 0,
      playerToAct: this.table.isHandInProgress() && this.table.isBettingRoundInProgress()
        ? this.table.playerToAct()
        : -1,
      legalActions,
      handResult: this.handResult,
      handNumber: this.handNumber,
    };
  }

  private emitState() {
    if (this.onUpdate) this.onUpdate(this.getState());
  }

  isHumanBusted(): boolean {
    return this._bustedSeats.has(0);
  }

  getHumanStack(): number {
    return this.table.seats()[0]?.totalChips ?? 0;
  }

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
