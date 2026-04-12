/**
 * Server-side poker room — authoritative game state for one table.
 *
 * Uses poker-ts as the engine. Manages player sessions, bot fill,
 * and broadcasts state diffs to connected WebSocket clients.
 */

import { Table } from "poker-ts";
import crypto from "crypto";

const NUM_SEATS = 6;
const SMALL_BLIND = 5;
const BIG_BLIND = 10;
const DEFAULT_BUY_IN = 1000;
const BOT_NAMES = ["Falcon", "Shor", "Grover", "Lattice", "Tidoshi"];

export interface PlayerInfo {
  id: string;
  name: string;
  seatIndex: number;
  isBot: boolean;
}

export interface RoomState {
  roomId: string;
  phase: string;
  players: SeatState[];
  communityCards: string[];
  pots: { size: number }[];
  dealerSeat: number;
  playerToAct: number;
  handNumber: number;
  winners: WinnerState[] | null;
}

export interface SeatState {
  seatIndex: number;
  name: string;
  stack: number;
  betSize: number;
  holeCards: string[] | null; // only sent to the owner
  folded: boolean;
  isBot: boolean;
  isAllIn: boolean;
  isEmpty: boolean;
}

export interface WinnerState {
  seatIndex: number;
  name: string;
  handDescription: string;
}

export interface LegalActionsMsg {
  actions: string[];
  minBet?: number;
  maxBet?: number;
}

type RoomListener = (event: string, data: unknown) => void;

export class HoldemRoom {
  readonly id: string;
  private table: InstanceType<typeof Table>;
  private players: (PlayerInfo | null)[] = new Array(NUM_SEATS).fill(null);
  private foldedSeats = new Set<number>();
  private handNumber = 0;
  private phase = "waiting";
  private communityCards: string[] = [];
  private holeCards: (string[] | null)[] = new Array(NUM_SEATS).fill(null);
  private deck: string[] = [];
  private deckIdx = 0;
  private winners: WinnerState[] | null = null;
  private listeners = new Map<string, RoomListener>(); // playerId -> listener
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private bustedSeats = new Set<number>();

  constructor(roomId?: string) {
    this.id = roomId ?? crypto.randomBytes(4).toString("hex");
    this.table = new Table(
      { smallBlind: SMALL_BLIND, bigBlind: BIG_BLIND },
      NUM_SEATS,
    );
  }

  /** Add a human player. Returns seat index or -1 if full. */
  addPlayer(playerId: string, name: string): number {
    // Check if already seated
    for (let i = 0; i < NUM_SEATS; i++) {
      if (this.players[i]?.id === playerId) return i;
    }
    // Find empty seat
    for (let i = 0; i < NUM_SEATS; i++) {
      if (this.players[i] === null) {
        this.players[i] = { id: playerId, name, seatIndex: i, isBot: false };
        this.table.sitDown(i, DEFAULT_BUY_IN);
        this.broadcast("player_joined", { seatIndex: i, name });
        return i;
      }
    }
    return -1;
  }

  removePlayer(playerId: string) {
    for (let i = 0; i < NUM_SEATS; i++) {
      if (this.players[i]?.id === playerId) {
        this.players[i] = null;
        this.listeners.delete(playerId);
        try { this.table.standUp(i); } catch { /* ok */ }
        this.broadcast("player_left", { seatIndex: i });
        break;
      }
    }
  }

  subscribe(playerId: string, listener: RoomListener) {
    this.listeners.set(playerId, listener);
  }

  unsubscribe(playerId: string) {
    this.listeners.delete(playerId);
  }

  /** Fill empty seats with bots. */
  fillBots() {
    let botIdx = 0;
    for (let i = 0; i < NUM_SEATS; i++) {
      if (this.players[i] === null && botIdx < BOT_NAMES.length) {
        const name = BOT_NAMES[botIdx]!;
        this.players[i] = { id: `bot-${i}`, name, seatIndex: i, isBot: true };
        this.table.sitDown(i, DEFAULT_BUY_IN);
        botIdx++;
      }
    }
  }

  humanCount(): number {
    return this.players.filter((p) => p !== null && !p.isBot).length;
  }

  getPlayerIds(): string[] {
    return this.players.filter((p): p is PlayerInfo => p !== null && !p.isBot).map((p) => p.id);
  }

  /** Start a new hand if enough players. */
  startHand() {
    // Re-buy busted bots
    for (let i = 0; i < NUM_SEATS; i++) {
      if (this.bustedSeats.has(i) && this.players[i]?.isBot) {
        this.table.sitDown(i, DEFAULT_BUY_IN);
        this.bustedSeats.delete(i);
      }
    }

    const seated = this.players.filter((p) => p !== null && !this.bustedSeats.has(p.seatIndex)).length;
    if (seated < 2) return;

    this.deck = shuffleDeck();
    this.deckIdx = 0;
    this.holeCards = new Array(NUM_SEATS).fill(null);
    this.communityCards = [];
    this.foldedSeats.clear();
    this.winners = null;
    this.handNumber++;

    try {
      this.table.startHand();
    } catch (e) {
      console.error("[Room] startHand error:", e);
      return;
    }
    this.phase = "preflop";

    // Deal hole cards
    for (let i = 0; i < NUM_SEATS; i++) {
      if (this.players[i] !== null && !this.bustedSeats.has(i)) {
        this.holeCards[i] = [this.deck[this.deckIdx++]!, this.deck[this.deckIdx++]!];
      }
    }

    this.broadcastState();
    this.pump();
  }

  /** Handle a player's action. */
  playerAction(playerId: string, action: string, betSize?: number) {
    const seat = this.players.findIndex((p) => p?.id === playerId);
    if (seat < 0) return;
    if (this.phase === "waiting" || this.phase === "hand_complete") return;

    try {
      if (!this.table.isHandInProgress() || !this.table.isBettingRoundInProgress()) return;
      if (this.table.playerToAct() !== seat) return;
      this.table.actionTaken(action as "fold" | "check" | "call" | "bet" | "raise", betSize);
      if (action === "fold") this.foldedSeats.add(seat);
    } catch (e) {
      console.error("[Room] playerAction error:", e);
      return;
    }

    this.broadcastState();
    this.pump();
  }

  /** State machine pump — runs bots, advances streets. */
  private pump() {
    if (this.botTimer) { clearTimeout(this.botTimer); this.botTimer = null; }
    this.pumpSync();
  }

  private pumpSync() {
    // Hand ended?
    if (!safeHandInProgress(this.table)) {
      this.finishHand();
      return;
    }

    if (!safeBettingInProgress(this.table)) {
      // Advance street
      try { this.table.endBettingRound(); } catch { this.finishHand(); return; }
      let done = false;
      try { done = this.table.areBettingRoundsCompleted(); } catch { done = true; }

      if (done) {
        try { this.table.showdown(); } catch { /* ok */ }
        this.finishHand();
        return;
      }

      this.dealStreetCards();
      this.broadcastState();
    }

    // Check whose turn it is
    if (!safeBettingInProgress(this.table)) { this.finishHand(); return; }

    let pta: number;
    try { pta = this.table.playerToAct(); } catch { this.finishHand(); return; }

    const player = this.players[pta];
    if (player?.isBot) {
      // Schedule bot action with delay
      this.botTimer = setTimeout(() => {
        this.botTimer = null;
        this.executeBotAction(pta);
        this.broadcastState();
        if (!safeHandInProgress(this.table)) { this.finishHand(); return; }
        this.pump();
      }, 500 + Math.random() * 500);
    } else {
      // Human's turn — send them their legal actions
      this.broadcastState();
    }
  }

  private executeBotAction(seatIndex: number) {
    let la;
    try { la = this.table.legalActions(); } catch { return; }

    const actions = la.actions as unknown as string[];
    // Simple bot: check > call > fold
    const pick = actions.includes("check") ? "check"
      : actions.includes("call") ? "call"
      : actions.includes("fold") ? "fold"
      : actions[0] ?? "fold";

    try {
      this.table.actionTaken(pick as "fold" | "check" | "call", undefined);
      if (pick === "fold") this.foldedSeats.add(seatIndex);
    } catch {
      try { this.table.actionTaken("fold"); this.foldedSeats.add(seatIndex); } catch { /* */ }
    }
  }

  private dealStreetCards() {
    let round: string;
    try { round = this.table.roundOfBetting(); } catch { return; }

    if (round === "flop") {
      this.phase = "flop";
      this.deckIdx++; // burn
      for (let i = 0; i < 3; i++) this.communityCards.push(this.deck[this.deckIdx++]!);
    } else if (round === "turn") {
      this.phase = "turn";
      this.deckIdx++;
      this.communityCards.push(this.deck[this.deckIdx++]!);
    } else if (round === "river") {
      this.phase = "river";
      this.deckIdx++;
      this.communityCards.push(this.deck[this.deckIdx++]!);
    }
  }

  private finishHand() {
    if (this.phase === "hand_complete") return;
    this.phase = "showdown";

    let rawWinners: unknown[][][] = [];
    try { rawWinners = this.table.winners() as unknown[][][]; } catch { /* */ }

    this.winners = [];
    if (rawWinners.length > 0) {
      for (const pot of rawWinners) {
        for (const wg of pot) {
          const idx = wg[0] as number;
          const hc = this.holeCards[idx];
          let desc = "Winner";
          if (wg[1] && typeof wg[1] === "object" && "ranking" in (wg[1] as Record<string, unknown>)) {
            const names = ["High Card","Pair","Two Pair","Three of a Kind","Straight","Flush","Full House","Four of a Kind","Straight Flush","Royal Flush"];
            desc = names[(wg[1] as { ranking: number }).ranking] ?? "Winner";
          }
          this.winners!.push({
            seatIndex: idx,
            name: this.players[idx]?.name ?? `Seat ${idx}`,
            handDescription: desc,
          });
        }
      }
    }

    if (this.winners.length === 0) {
      for (let i = 0; i < NUM_SEATS; i++) {
        if (this.players[i] && !this.foldedSeats.has(i) && !this.bustedSeats.has(i)) {
          this.winners.push({ seatIndex: i, name: this.players[i]!.name, handDescription: "Last player standing" });
          break;
        }
      }
    }

    // Mark busted
    const seats = this.table.seats();
    for (let i = 0; i < NUM_SEATS; i++) {
      if (seats[i] !== null && seats[i]!.totalChips <= 0) {
        this.bustedSeats.add(i);
        try { this.table.standUp(i); } catch { /* */ }
      }
    }

    this.phase = "hand_complete";
    this.broadcastState();

    // Auto-start next hand after delay
    setTimeout(() => {
      if (this.humanCount() > 0) this.startHand();
    }, 3000);
  }

  /** Build state for a specific player (hides other players' cards). */
  getStateForPlayer(playerId: string): RoomState & { yourSeat: number; legalActions: LegalActionsMsg | null } {
    const mySeat = this.players.findIndex((p) => p?.id === playerId);
    const seats = this.table.seats();
    const handInProgress = safeHandInProgress(this.table);
    const bettingInProgress = handInProgress && safeBettingInProgress(this.table);

    let handPlayers: ({ stack: number; betSize: number } | null)[] | null = null;
    let pots: { size: number }[] = [];
    if (handInProgress) {
      try { handPlayers = this.table.handPlayers(); } catch { /* */ }
      try { pots = this.table.pots(); } catch { /* */ }
    }

    const seatStates: SeatState[] = [];
    for (let i = 0; i < NUM_SEATS; i++) {
      const p = this.players[i];
      if (!p) {
        seatStates.push({ seatIndex: i, name: "", stack: 0, betSize: 0, holeCards: null, folded: false, isBot: false, isAllIn: false, isEmpty: true });
        continue;
      }
      const hp = handPlayers?.[i];
      const s = hp ?? seats[i];
      const isInHand = hp !== null && hp !== undefined;
      const folded = this.foldedSeats.has(i) || (!isInHand && handInProgress);

      // Only show cards to the card owner, or at showdown
      let cards: string[] | null = null;
      if (this.holeCards[i]) {
        if (i === mySeat || this.phase === "showdown" || this.phase === "hand_complete") {
          if (!folded || i === mySeat) cards = this.holeCards[i];
        }
      }

      seatStates.push({
        seatIndex: i, name: p.name,
        stack: s?.stack ?? 0, betSize: s?.betSize ?? 0,
        holeCards: cards, folded, isBot: p.isBot,
        isAllIn: (s?.stack ?? 0) === 0 && !folded && isInHand,
        isEmpty: false,
      });
    }

    let legalActions: LegalActionsMsg | null = null;
    if (bettingInProgress && mySeat >= 0) {
      try {
        if (this.table.playerToAct() === mySeat) {
          const la = this.table.legalActions();
          legalActions = {
            actions: la.actions as unknown as string[],
            minBet: la.chipRange?.min,
            maxBet: la.chipRange?.max,
          };
        }
      } catch { /* */ }
    }

    let dealerSeat = 0;
    if (handInProgress) { try { dealerSeat = this.table.button(); } catch { /* */ } }

    let playerToAct = -1;
    if (bettingInProgress) { try { playerToAct = this.table.playerToAct(); } catch { /* */ } }

    return {
      roomId: this.id,
      phase: this.phase,
      players: seatStates,
      communityCards: this.communityCards,
      pots,
      dealerSeat,
      playerToAct,
      handNumber: this.handNumber,
      winners: this.winners,
      yourSeat: mySeat,
      legalActions,
    };
  }

  private broadcast(event: string, data: unknown) {
    for (const [, listener] of this.listeners) {
      try { listener(event, data); } catch { /* */ }
    }
  }

  private broadcastState() {
    for (const [playerId, listener] of this.listeners) {
      try {
        const state = this.getStateForPlayer(playerId);
        listener("game_state", state);
      } catch { /* */ }
    }
  }

  destroy() {
    if (this.botTimer) clearTimeout(this.botTimer);
    this.listeners.clear();
  }
}

// --- Helpers ---

function safeHandInProgress(table: InstanceType<typeof Table>): boolean {
  try { return table.isHandInProgress(); } catch { return false; }
}
function safeBettingInProgress(table: InstanceType<typeof Table>): boolean {
  try { return table.isBettingRoundInProgress(); } catch { return false; }
}

const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const SUITS = ["s","h","d","c"];

function shuffleDeck(): string[] {
  const deck: string[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  const rand = new Uint32Array(deck.length);
  crypto.getRandomValues(rand);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rand[i]! % (i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}
