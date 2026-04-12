/** Main poker table — assembles seats, community cards, pots, and action bar. */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, PlayerAction } from "@/game/types";
import { GameManager } from "@/game/gameManager";
import { Seat } from "./Seat";
import { CommunityCards } from "./CommunityCards";
import { PotDisplay } from "./PotDisplay";
import { ActionBar } from "./ActionBar";
import { HandResultOverlay } from "./HandResult";
import { TidecoinPanel } from "./TidecoinPanel";

const DEFAULT_BUY_IN = 1000;

export function PokerTable() {
  const gmRef = useRef<GameManager | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [started, setStarted] = useState(false);

  // Initialize game manager once
  useEffect(() => {
    const gm = new GameManager();
    gm.setOnUpdate((state) => setGameState({ ...state }));
    gmRef.current = gm;
    gm.initialize("You", DEFAULT_BUY_IN);
  }, []);

  const startHand = useCallback(() => {
    gmRef.current?.startHand();
    setStarted(true);
  }, []);

  const handleAction = useCallback((action: PlayerAction, betSize?: number) => {
    gmRef.current?.humanAction(action, betSize);
  }, []);

  const handleNextHand = useCallback(() => {
    const gm = gmRef.current;
    if (!gm) return;
    if (gm.isHumanBusted()) {
      gm.humanRebuy(DEFAULT_BUY_IN);
    }
    gm.startHand();
  }, []);

  const handleBuyIn = useCallback((chips: number) => {
    const gm = gmRef.current;
    if (!gm) return;
    if (gm.isHumanBusted()) {
      gm.humanRebuy(chips);
    }
  }, []);

  if (!gameState) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  const potSize = gameState.pots.reduce((s, p) => s + p.size, 0);

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:gap-8">
      {/* Main game area */}
      <div className="flex-1 w-full max-w-3xl">
        {/* Table */}
        <div className="relative mx-auto" style={{ height: 480, maxWidth: 720 }}>
          {/* Felt surface */}
          <div
            className="absolute inset-4 rounded-[50%] border-4 border-yellow-900/60 shadow-2xl"
            style={{
              background:
                "radial-gradient(ellipse at center, #1a5c3a 0%, #0f3d26 60%, #0a2e1c 100%)",
            }}
          />

          {/* Community cards + pot in center */}
          <div className="absolute left-1/2 top-[40%] z-10 -translate-x-1/2 -translate-y-1/2 text-center">
            <PotDisplay pots={gameState.pots} />
            <div className="mt-2">
              <CommunityCards cards={gameState.communityCards} />
            </div>
            {gameState.phase !== "waiting" && (
              <div className="mt-2 text-xs uppercase tracking-wider text-emerald-400/60">
                {gameState.phase === "hand_complete" ? "showdown" : gameState.phase}
              </div>
            )}
          </div>

          {/* Seats */}
          {gameState.players.map((player) => (
            <Seat
              key={player.seatIndex}
              player={player}
              isActive={gameState.playerToAct === player.seatIndex}
              isDealer={gameState.dealerSeat === player.seatIndex}
            />
          ))}

          {/* Hand result overlay */}
          {gameState.phase === "hand_complete" && gameState.handResult && (
            <HandResultOverlay
              result={gameState.handResult}
              onNextHand={handleNextHand}
              humanBusted={gmRef.current?.isHumanBusted() ?? false}
            />
          )}

          {/* Start game overlay */}
          {!started && (
            <div className="absolute inset-0 z-30 flex items-center justify-center rounded-[50%]">
              <button
                onClick={startHand}
                className="rounded-xl bg-brand px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-brand-dim hover:scale-105"
              >
                Deal
              </button>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="mt-2">
          <ActionBar
            legalActions={gameState.legalActions}
            potSize={potSize}
            onAction={handleAction}
          />
        </div>

        {/* Hand counter */}
        <div className="mt-2 text-center text-xs text-slate-600">
          Hand #{gameState.handNumber}
        </div>
      </div>

      {/* Tidecoin panel — sidebar */}
      <div className="w-full max-w-[220px] shrink-0">
        <TidecoinPanel
          chipStack={gmRef.current?.getHumanStack() ?? DEFAULT_BUY_IN}
          onBuyIn={handleBuyIn}
        />
      </div>
    </div>
  );
}
