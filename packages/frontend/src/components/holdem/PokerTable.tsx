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
import { ChipPanel } from "./ChipPanel";

const DEFAULT_BUY_IN = 1000;

export function PokerTable() {
  const gmRef = useRef<GameManager | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [started, setStarted] = useState(false);

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
    if (gm.isHumanBusted()) gm.humanRebuy(DEFAULT_BUY_IN);
    gm.startHand();
  }, []);

  const handleRebuy = useCallback(() => {
    gmRef.current?.humanRebuy(DEFAULT_BUY_IN);
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
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
      {/* Main game area */}
      <div className="flex-1 min-w-0">
        {/* Table container — wider aspect ratio for a proper ellipse */}
        <div className="relative mx-auto" style={{ height: 540, maxWidth: 800 }}>
          {/* Outer rail */}
          <div
            className="absolute shadow-2xl"
            style={{
              top: "10%",
              left: "8%",
              right: "8%",
              bottom: "14%",
              borderRadius: "50%",
              background: "#3a2010",
              padding: 6,
            }}
          >
            {/* Felt surface */}
            <div
              className="h-full w-full"
              style={{
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse at 50% 45%, #1e7a4a 0%, #145a35 50%, #0d3d24 100%)",
                boxShadow: "inset 0 2px 20px rgba(0,0,0,0.4)",
              }}
            />
          </div>

          {/* Community cards + pot — centered on the felt */}
          <div className="absolute left-1/2 top-[42%] z-10 -translate-x-1/2 -translate-y-1/2 text-center">
            <PotDisplay pots={gameState.pots} />
            <div className="mt-3">
              <CommunityCards cards={gameState.communityCards} />
            </div>
            {gameState.phase !== "waiting" && (
              <div className="mt-2 text-[10px] uppercase tracking-widest text-emerald-300/50">
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

          {/* Deal button */}
          {!started && (
            <div className="absolute inset-0 z-30 flex items-center justify-center">
              <button
                onClick={startHand}
                className="rounded-xl bg-brand px-10 py-4 text-lg font-semibold text-white shadow-2xl transition hover:bg-brand-dim hover:scale-105 active:scale-95"
              >
                Deal
              </button>
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="mt-4">
          <ActionBar
            legalActions={gameState.legalActions}
            potSize={potSize}
            onAction={handleAction}
          />
        </div>

        <div className="mt-2 text-center text-xs text-slate-600">
          Hand #{gameState.handNumber}
        </div>
      </div>

      {/* Chip panel sidebar */}
      <div className="w-full max-w-[200px] shrink-0 xl:mt-8">
        <ChipPanel
          chipStack={gmRef.current?.getHumanStack() ?? DEFAULT_BUY_IN}
          handsPlayed={gameState.handNumber}
          onRebuy={handleRebuy}
        />
      </div>
    </div>
  );
}
