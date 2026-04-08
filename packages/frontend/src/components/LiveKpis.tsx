"use client";

/**
 * <LiveKpis /> — dashboard KPI strip that updates in real time from
 * the 'status' and 'mempool' WebSocket channels.
 *
 * Initial values come from the server-rendered /status fetch on the
 * home page (passed as props) so the first paint has real numbers —
 * no CLS, no "loading..." state. After hydration, we subscribe to
 * the live channels and replace the individual values as events
 * arrive.
 *
 * The value tweens with a brief highlight flash when it changes, so
 * you can see the chain ticking without staring at the numbers.
 */

import { useEffect, useState } from "react";
import { useChannel } from "@/lib/use-channel";

export interface LiveKpisProps {
  initial: {
    tipHeight: number;
    supplyTdc: string;
    mempoolTxCount: number;
    peers: number;
  };
}

interface StatusEventPayload {
  type: "status";
  tipHeight: number;
  tipHash: string;
  difficulty: number;
  peers: number;
  networkHashPs: number;
}

interface MempoolEventPayload {
  type: "mempool";
  txCount: number;
  bytes: number;
  minFeeTdcPerKb: number;
}

export function LiveKpis({ initial }: LiveKpisProps) {
  const [tipHeight, setTipHeight] = useState(initial.tipHeight);
  const [peers, setPeers] = useState(initial.peers);
  const [mempoolTxCount, setMempoolTxCount] = useState(initial.mempoolTxCount);
  // Supply doesn't tick via WS (it's computed from gettxoutsetinfo
  // which is expensive to poll); stays at the initial server value.
  const supplyTdc = initial.supplyTdc;

  useChannel<StatusEventPayload>("status", (payload) => {
    if (!payload || payload.type !== "status") return;
    setTipHeight(payload.tipHeight);
    setPeers(payload.peers);
  });

  useChannel<MempoolEventPayload>("mempool", (payload) => {
    if (!payload || payload.type !== "mempool") return;
    setMempoolTxCount(payload.txCount);
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AnimatedKpi label="Tip height" value={tipHeight.toLocaleString()} />
      <AnimatedKpi
        label="Supply (TDC)"
        value={Number(supplyTdc).toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })}
      />
      <AnimatedKpi
        label="Mempool txs"
        value={mempoolTxCount.toString()}
      />
      <AnimatedKpi label="Peers" value={peers.toString()} />
    </div>
  );
}

function AnimatedKpi({ label, value }: { label: string; value: string }) {
  const [flash, setFlash] = useState(false);
  const [prev, setPrev] = useState(value);

  useEffect(() => {
    if (value === prev) return;
    setFlash(true);
    setPrev(value);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [value, prev]);

  return (
    <div
      className={
        "rounded-lg border bg-surface-1 p-5 transition-colors duration-500 " +
        (flash ? "border-brand-glow" : "border-surface-3")
      }
    >
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={
          "mono mt-2 text-2xl font-semibold transition-colors duration-500 " +
          (flash ? "text-brand-glow" : "text-slate-100")
        }
      >
        {value}
      </div>
    </div>
  );
}
