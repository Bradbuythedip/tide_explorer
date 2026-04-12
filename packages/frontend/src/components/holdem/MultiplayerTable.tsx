/** Live multiplayer poker table — connects to backend via WebSocket. */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Seat } from "./Seat";
import { CommunityCards } from "./CommunityCards";
import { PotDisplay } from "./PotDisplay";
import { ActionBar } from "./ActionBar";
import { HandResultOverlay } from "./HandResult";
import type { CardDisplay, PlayerAction, Rank, Suit, CardStr } from "@/game/types";

interface ServerSeat {
  seatIndex: number;
  name: string;
  stack: number;
  betSize: number;
  holeCards: string[] | null;
  folded: boolean;
  isBot: boolean;
  isAllIn: boolean;
  isEmpty: boolean;
}

interface ServerState {
  roomId: string;
  phase: string;
  players: ServerSeat[];
  communityCards: string[];
  pots: { size: number }[];
  dealerSeat: number;
  playerToAct: number;
  handNumber: number;
  winners: { seatIndex: number; name: string; handDescription: string }[] | null;
  yourSeat: number;
  legalActions: { actions: string[]; minBet?: number; maxBet?: number } | null;
}

function parseCard(s: string): CardDisplay {
  return { rank: s[0] as Rank, suit: s[1] as Suit, str: s as CardStr };
}

function getWsUrl(roomId: string, playerName: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/v1/holdem/play/${roomId}?name=${encodeURIComponent(playerName)}`;
}

export function MultiplayerTable({
  roomId,
  playerName,
}: {
  roomId: string;
  playerName: string;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<ServerState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connect WebSocket
  useEffect(() => {
    const url = getWsUrl(roomId, playerName);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (evt) => {
      let msg: { type: string; data?: ServerState; message?: string };
      try { msg = JSON.parse(evt.data as string); } catch { return; }

      if (msg.type === "game_state" && msg.data) {
        setState(msg.data);
      } else if (msg.type === "error") {
        setError(msg.message ?? "Unknown error");
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };

    ws.onerror = () => {
      setConnected(false);
    };

    // Keepalive
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);

    return () => {
      clearInterval(ping);
      ws.close();
      wsRef.current = null;
    };
  }, [roomId, playerName]);

  const sendAction = useCallback((action: PlayerAction, betSize?: number) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "action", action, betSize }));
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-500">
        {connected ? "Waiting for game state..." : "Connecting..."}
      </div>
    );
  }

  // Convert server state to component props
  const communityCards = state.communityCards.map(parseCard);
  const potSize = state.pots.reduce((s, p) => s + p.size, 0);

  const players = state.players.map((p) => ({
    seatIndex: p.seatIndex,
    name: p.isEmpty ? "" : p.name,
    stack: p.stack,
    betSize: p.betSize,
    totalChips: p.stack,
    holeCards: p.holeCards?.map(parseCard) ?? null,
    folded: p.folded,
    isBot: p.isBot,
    isAllIn: p.isAllIn,
    personality: undefined,
    isEmpty: p.isEmpty,
  }));

  const legalActions = state.legalActions
    ? {
        actions: state.legalActions.actions as PlayerAction[],
        minBet: state.legalActions.minBet,
        maxBet: state.legalActions.maxBet,
      }
    : null;

  const showResult = (state.phase === "showdown" || state.phase === "hand_complete") && state.winners && state.winners.length > 0;

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
      <div className="flex-1 min-w-0">
        {/* Table */}
        <div className="relative mx-auto" style={{ height: 540, maxWidth: 800 }}>
          {/* Rail + felt */}
          <div
            className="absolute shadow-2xl"
            style={{ top: "10%", left: "8%", right: "8%", bottom: "14%", borderRadius: "50%", background: "#3a2010", padding: 6 }}
          >
            <div
              className="h-full w-full"
              style={{ borderRadius: "50%", background: "radial-gradient(ellipse at 50% 45%, #1e7a4a 0%, #145a35 50%, #0d3d24 100%)", boxShadow: "inset 0 2px 20px rgba(0,0,0,0.4)" }}
            />
          </div>

          {/* Center: pot + community cards */}
          <div className="absolute left-1/2 top-[42%] z-10 -translate-x-1/2 -translate-y-1/2 text-center">
            <PotDisplay pots={state.pots.map((p) => ({ size: p.size, eligiblePlayers: [] }))} />
            <div className="mt-3">
              <CommunityCards cards={communityCards} />
            </div>
            {state.phase !== "waiting" && (
              <div className="mt-2 text-[10px] uppercase tracking-widest text-emerald-300/50">
                {state.phase === "hand_complete" ? "showdown" : state.phase}
              </div>
            )}
          </div>

          {/* Seats */}
          {players.map((p) => (
            !p.isEmpty && (
              <Seat
                key={p.seatIndex}
                player={p as any}
                isActive={state.playerToAct === p.seatIndex}
                isDealer={state.dealerSeat === p.seatIndex}
              />
            )
          ))}

          {/* Showdown overlay */}
          {showResult && state.winners && (
            <HandResultOverlay
              result={{
                winners: state.winners.map((w) => ({
                  seatIndex: w.seatIndex,
                  playerName: w.name,
                  handDescription: w.handDescription,
                  amount: 0,
                })),
                potSize,
              }}
              onNextHand={() => {}} // Server auto-starts next hand
              humanBusted={false}
            />
          )}

          {/* Waiting overlay */}
          {state.phase === "waiting" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center">
              <div className="rounded-xl bg-surface-1/90 px-8 py-4 text-center backdrop-blur-sm">
                <div className="text-lg font-semibold text-slate-200">Waiting for players...</div>
                <div className="mt-1 text-sm text-slate-500">The hand will start automatically.</div>
              </div>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="mt-4">
          <ActionBar legalActions={legalActions} potSize={potSize} onAction={sendAction} />
        </div>

        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-600">
          <span>Hand #{state.handNumber}</span>
          <span>Room {state.roomId.slice(0, 6)}</span>
          <span className={connected ? "text-threat-safe" : "text-red-400"}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Info panel */}
      <div className="w-full max-w-[200px] shrink-0 xl:mt-8">
        <div className="rounded-xl border border-surface-3 bg-surface-1/95 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? "bg-threat-safe" : "bg-red-500"}`} />
            <span className="text-xs font-medium text-slate-300">Live Table</span>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-slate-500">Your Seat</div>
              <div className="text-sm text-brand-glow">{state.yourSeat >= 0 ? `Seat ${state.yourSeat + 1}` : "Spectating"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Your Stack</div>
              <div className="font-mono text-lg font-semibold text-yellow-400">
                {state.yourSeat >= 0 ? state.players[state.yourSeat]?.stack?.toLocaleString() ?? "—" : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Players</div>
              <div className="text-sm text-slate-300">
                {state.players.filter((p) => !p.isEmpty).length}/6
              </div>
            </div>
            <div className="border-t border-surface-3 pt-2 mt-2 text-xs text-slate-600">
              Play money. No real TDC.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
