"use client";

/**
 * <RecentBlocks /> — live-updating dashboard panel showing the
 * most recent N blocks.
 *
 * On mount:
 *   1. Fetch the initial list from /api/v1/blocks/recent
 *   2. Subscribe to the 'blocks' WebSocket channel
 *
 * When a new block event arrives from the backend's EventPoller,
 * we prepend it to the list and trim to max length. If the new
 * block is already present (possible after a reconnect + replay),
 * we dedupe by height.
 *
 * A subtle highlight animation plays on the newest row each time a
 * block arrives so the user can feel the chain tick.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useChannel } from "@/lib/use-channel";
import type { RecentBlockSummary } from "@/lib/api";

interface BlockEventPayload {
  type: "block";
  block: {
    height: number;
    hash: string;
    time: number;
    txCount: number;
    sizeBytes: number;
    weight: number;
    totalOutTdc: string;
    falconTxCount: number;
    p2pkFalconTxCount: number;
  };
}

interface Props {
  initial: RecentBlockSummary[];
  maxRows?: number;
}

export function RecentBlocks({ initial, maxRows = 15 }: Props) {
  const [blocks, setBlocks] = useState<RecentBlockSummary[]>(initial);
  const [flashHeight, setFlashHeight] = useState<number | null>(null);

  // Keep a stable 'now' for the relative-time display, tick every 5s.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(i);
  }, []);

  useChannel<BlockEventPayload>("blocks", (payload) => {
    if (!payload || payload.type !== "block" || !payload.block) return;
    const b = payload.block;
    const summary: RecentBlockSummary = {
      height: b.height,
      hash: b.hash,
      time: b.time,
      txCount: b.txCount,
      sizeBytes: b.sizeBytes,
      weight: b.weight,
      totalOutTdc: b.totalOutTdc,
      minerTag: null,
      hasFalconInputs: b.falconTxCount > 0,
      hasP2pkFalconOut: b.p2pkFalconTxCount > 0,
    };
    setBlocks((prev) => {
      if (prev.some((p) => p.height === summary.height)) return prev;
      return [summary, ...prev].slice(0, maxRows);
    });
    setFlashHeight(summary.height);
    // Also notify other components (Toaster) about the new block
    // via a window event so they don't need their own subscription.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("prevblock:new-block", { detail: summary }),
      );
    }
  });

  // Clear the flash after the CSS animation finishes.
  useEffect(() => {
    if (flashHeight === null) return;
    const t = setTimeout(() => setFlashHeight(null), 1_500);
    return () => clearTimeout(t);
  }, [flashHeight]);

  if (blocks.length === 0) {
    return (
      <div className="rounded-lg border border-surface-3 bg-surface-1 p-6 text-sm text-slate-500">
        No blocks loaded yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-surface-3">
      <div className="flex items-baseline justify-between border-b border-surface-3 bg-surface-1 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Recent blocks</h2>
        <span className="text-xs text-slate-500">
          live · updates as new blocks are mined
        </span>
      </div>
      <ul>
        {blocks.map((b) => {
          const isFlash = b.height === flashHeight;
          return (
            <li
              key={b.height}
              className={
                "flex items-center gap-4 border-t border-surface-2/60 px-4 py-3 text-sm transition-colors " +
                (isFlash
                  ? "bg-brand/10"
                  : "hover:bg-surface-1")
              }
            >
              <Link
                href={`/block/${b.height}`}
                className="mono shrink-0 tabular-nums text-brand-glow"
              >
                #{b.height.toLocaleString()}
              </Link>
              <span className="text-slate-500">·</span>
              <span className="shrink-0 text-xs text-slate-500">
                {relativeTime(b.time * 1000, now)}
              </span>
              <span className="text-slate-500">·</span>
              <span className="shrink-0 text-xs text-slate-400">
                {b.txCount} tx{b.txCount === 1 ? "" : "s"}
              </span>
              <span className="text-slate-500">·</span>
              <span className="mono shrink-0 text-xs text-slate-400">
                {formatBytes(b.sizeBytes)}
              </span>
              <span className="ml-auto mono shrink-0 text-xs text-slate-300">
                {Number(b.totalOutTdc).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                TDC
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function relativeTime(whenMs: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - whenMs) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
