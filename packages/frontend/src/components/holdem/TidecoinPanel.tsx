/** Tidecoin mainnet integration panel — address, balance, buy-in. */

"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/v1`
    : "";

interface TidecoinState {
  connected: boolean;
  address: string | null;
  balanceTdc: string | null;
  loading: boolean;
  error: string | null;
}

async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(`${API_BASE}/holdem/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      (body as { message?: string })?.message ?? `RPC failed: ${res.status}`,
    );
  }
  const data = await res.json();
  return (data as { result: unknown }).result;
}

export function TidecoinPanel({
  chipStack,
  onBuyIn,
}: {
  chipStack: number;
  onBuyIn: (chips: number) => void;
}) {
  const [state, setState] = useState<TidecoinState>({
    connected: false,
    address: null,
    balanceTdc: null,
    loading: true,
    error: null,
  });
  const [buyInTdc, setBuyInTdc] = useState("10");

  // Check connection + get address + balance on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const info = await rpc("getblockchaininfo");
        if (cancelled) return;

        const addr = (await rpc("getnewaddress")) as string;
        if (cancelled) return;

        const balance = (await rpc("getbalance")) as number;
        if (cancelled) return;

        setState({
          connected: true,
          address: addr,
          balanceTdc: balance.toFixed(8),
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          connected: false,
          address: null,
          balanceTdc: null,
          loading: false,
          error: "Node offline",
        });
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Refresh balance periodically
  useEffect(() => {
    if (!state.connected) return;
    const id = setInterval(async () => {
      try {
        const balance = (await rpc("getbalance")) as number;
        setState((prev) => ({ ...prev, balanceTdc: balance.toFixed(8) }));
      } catch { /* ignore */ }
    }, 30_000);
    return () => clearInterval(id);
  }, [state.connected]);

  const handleBuyIn = useCallback(() => {
    const tdc = parseFloat(buyInTdc);
    if (isNaN(tdc) || tdc <= 0) return;
    // 1 TDC = 100 chips
    onBuyIn(Math.round(tdc * 100));
  }, [buyInTdc, onBuyIn]);

  return (
    <div className="rounded-xl border border-surface-3 bg-surface-1/95 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            state.connected ? "bg-threat-safe" : "bg-red-500"
          }`}
        />
        <span className="text-xs font-medium text-slate-300">
          Tidecoin {state.connected ? "Mainnet" : "Offline"}
        </span>
      </div>

      {state.loading ? (
        <div className="text-xs text-slate-500">Connecting...</div>
      ) : state.connected ? (
        <div className="space-y-2">
          {state.address && (
            <div>
              <div className="text-xs text-slate-500">Address</div>
              <div className="font-mono text-xs text-slate-300 truncate" title={state.address}>
                {state.address}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs text-slate-500">Balance</div>
            <div className="font-mono text-sm text-brand-glow">
              {state.balanceTdc} TDC
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Chip Stack</div>
            <div className="font-mono text-sm text-yellow-400">
              {chipStack.toLocaleString()} chips
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="number"
              min="0.01"
              step="1"
              value={buyInTdc}
              onChange={(e) => setBuyInTdc(e.target.value)}
              className="w-20 rounded bg-surface-2 px-2 py-1 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-brand"
              placeholder="TDC"
            />
            <button
              onClick={handleBuyIn}
              className="rounded bg-brand px-3 py-1 text-xs font-medium text-white hover:bg-brand-dim"
            >
              Buy In
            </button>
          </div>
          <div className="text-xs text-slate-600">1 TDC = 100 chips</div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-xs text-slate-500">{state.error}</div>
          <div className="text-xs text-slate-600">
            Game uses default 1,000 chip stack.
          </div>
        </div>
      )}
    </div>
  );
}
