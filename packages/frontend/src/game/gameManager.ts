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

/** Convert a CardStr like "As" to a CardDisplay object. */
function parseCard(s: CardStr): CardDisplay {
  return {
    rank: s[0] as Rank,
    suit: s[1] as Suit,
    str: s,
  };
}

/** Convert poker-ts Card object to our CardDisplay. */
function pokerTsCardToDisplay(c: { rank: string; suit: string }): CardDisplay {
  const suitMap: Record<string, Suit> = {
    spades: "s", hearts: "h", diamonds: "d", clubs: "c",
  };
  return {
    rank: c.rank as Rank,
    suit: suitMap[c.suit] ?? ("s" as Suit),
    str: `${c.rank}${suitMap[c.suit] ?? "s"}` as CardStr,
  };
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

  constructor() {
    this.table = new Table(
      { smallBlind: SMALL_BLIND, bigBlind: BIG_BLIND },
      NUM_SEATS,
    );
  }

  setOnUpdate(cb: GameEventCallback) {
    this.onUpdate = cb;
  }

  /** Seat the human and 5 bots, then emit initial state. */
  initialize(humanName: string, buyIn: number = DEFAULT_BUY_IN) {
    this.playerNames = [humanName];
    this.botPersonalities = [null]; // seat 0 = human

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

  /** Start a new hand. */
  startHand() {
    // Re-buy busted players (bots auto re-buy)
    const seats = this.table.seats();
    for (let i = 1; i < NUM_SEATS; i++) {
      if (this._bustedSeats.has(i)) {
        this.table.sitDown(i, DEFAULT_BUY_IN);
        this._bustedSeats.delete(i);
      }
    }

    // Check human is still in
    if (this._bustedSeats.has(0)) return;

    // Shuffle and prepare deck
    this._shuffledDeck = secureShuffle(buildDeck());
    this._dealIndex = 0;
    this._holeCards = new Array(NUM_SEATS).fill(null);
    this._communityCards = [];
    this.foldedSeats.clear();
    this.handResult = null;
    this.handNumber++;

    this.table.startHand();
    this.phase = "preflop";

    // Deal hole cards
    for (let i = 0; i < NUM_SEATS; i++) {
      const seat = seats[i];
      if (seat !== null && !this._bustedSeats.has(i)) {
        this._holeCards[i] = [
          parseCard(this._shuffledDeck[this._dealIndex++]!),
          parseCard(this._shuffledDeck[this._dealIndex++]!),
        ];
      }
    }

    this.emitState();

    // If it's a bot's turn, auto-act
    this.runBotActionsIfNeeded();
  }

  /** Human takes an action. */
  humanAction(action: PlayerAction, betSize?: number) {
    if (this.phase === "waiting" || this.phase === "hand_complete" || this.phase === "showdown") return;

    try {
      const playerToAct = this.table.playerToAct();
      if (playerToAct !== 0) return; // Not human's turn

      this.table.actionTaken(action, betSize);

      if (action === "fold") {
        this.foldedSeats.add(0);
      }

      this.emitState();
      this.advanceIfNeeded();
    } catch (e) {
      console.error("[GameManager] humanAction error:", e);
    }
  }

  /** Get current snapshot for UI. */
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
          stack: 0,
          betSize: 0,
          totalChips: 0,
          holeCards: null,
          folded: true,
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

      // Only show hole cards to human (seat 0) during play,
      // or to everyone at showdown
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
        const pta = this.table.playerToAct();
        if (pta === 0) {
          const la = this.table.legalActions();
          legalActions = {
            actions: la.actions as PlayerAction[],
            minBet: la.chipRange?.min,
            maxBet: la.chipRange?.max,
          };
        }
      } catch {
        // Not player's turn
      }
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
    if (this.onUpdate) {
      this.onUpdate(this.getState());
    }
  }

  /** Run bot actions if it's a bot's turn. Returns a promise for chained delays. */
  private async runBotActionsIfNeeded() {
    while (
      this.table.isHandInProgress() &&
      this.table.isBettingRoundInProgress()
    ) {
      const pta = this.table.playerToAct();
      if (pta === 0) break; // Human's turn

      // Delay for visual pacing
      await delay(400 + Math.random() * 300);

      this.executeBotAction(pta);
      this.emitState();
    }

    // After bots finish, check if we need to advance
    this.advanceIfNeeded();
  }

  private executeBotAction(seatIndex: number) {
    const personality = this.botPersonalities[seatIndex];
    if (!personality) return;

    const la = this.table.legalActions();
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
      if (decision.action === "fold") {
        this.foldedSeats.add(seatIndex);
      }
    } catch (e) {
      // If the chosen action fails, try simpler fallbacks
      try {
        if (la.actions.includes("check")) {
          this.table.actionTaken("check");
        } else if (la.actions.includes("call")) {
          this.table.actionTaken("call");
        } else {
          this.table.actionTaken("fold");
          this.foldedSeats.add(seatIndex);
        }
      } catch {
        // Last resort
        try {
          this.table.actionTaken("fold");
          this.foldedSeats.add(seatIndex);
        } catch { /* seat might already be out */ }
      }
    }
  }

  private advanceIfNeeded() {
    if (!this.table.isHandInProgress()) return;

    // Check if betting round is complete
    if (!this.table.isBettingRoundInProgress()) {
      if (this.table.areBettingRoundsCompleted()) {
        // Go to showdown
        this.doShowdown();
        return;
      }

      // Deal next street
      this.dealNextStreet();
      this.emitState();

      // Run bots on new street
      this.runBotActionsIfNeeded();
    }
  }

  private dealNextStreet() {
    this.table.endBettingRound();

    const round = this.table.roundOfBetting();
    if (round === "flop") {
      this.phase = "flop";
      // Burn one, deal three
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

  private doShowdown() {
    this.phase = "showdown";
    this.table.showdown();

    const winnersData = this.table.winners();
    const winners: WinnerInfo[] = [];

    // winners() returns a 3D array: [pot][winner group][seat, hand info, cards]
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
          amount: 0, // poker-ts doesn't expose individual pot awards easily
        });
      }
    }

    const pots = this.table.pots();
    const totalPot = pots.reduce((s, p) => s + p.size, 0);

    this.handResult = {
      winners,
      potSize: totalPot,
    };

    // Check for busted players
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

  /** Check if human is busted. */
  isHumanBusted(): boolean {
    return this._bustedSeats.has(0);
  }

  /** Get human's current stack. */
  getHumanStack(): number {
    const seats = this.table.seats();
    return seats[0]?.totalChips ?? 0;
  }

  /** Re-buy the human player. */
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
