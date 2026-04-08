/**
 * Event poller — single background loop that watches the Tidecoin
 * node for tip changes and mempool changes, and emits events via
 * an internal EventEmitter that the WebSocket hub subscribes to.
 *
 * Why polling instead of ZMQ: Phase 0 confirmed the running Tidecoin
 * node has no ZMQ topics configured (getzmqnotifications returns []),
 * so polling is the only way. Every ~5 seconds we:
 *
 *   1. getBlockCount() — cheap, one int back
 *   2. If the tip changed, getBlockVerbose2(newTipHash) and emit a
 *      'block' event with the decoded block summary
 *   3. getMempoolInfo() — also cheap
 *   4. If mempool stats changed meaningfully, emit a 'mempool' event
 *
 * Single instance per backend process. Starts on server boot via
 * Fastify's onReady hook. Stops cleanly on onClose.
 *
 * Node RPC calls are ~5ms each when the node is warm, so the poll
 * loop is essentially free.
 */

import { EventEmitter } from "node:events";
import type { TidecoinRpcClient } from "@prevblock/rpc-client";
import type { Logger } from "pino";
import { projectBlock, type BlockDetail } from "./tx-view.js";

export interface BlockEvent {
  type: "block";
  block: BlockDetail;
}

export interface MempoolEvent {
  type: "mempool";
  txCount: number;
  bytes: number;
  minFeeTdcPerKb: number;
}

export interface StatusEvent {
  type: "status";
  tipHeight: number;
  tipHash: string;
  difficulty: number;
  peers: number;
  networkHashPs: number;
}

export type PollerEvent = BlockEvent | MempoolEvent | StatusEvent;

type TypedEmitter = EventEmitter & {
  on(event: "event", listener: (ev: PollerEvent) => void): EventEmitter;
  emit(event: "event", ev: PollerEvent): boolean;
};

export interface EventPollerDeps {
  rpc: TidecoinRpcClient;
  logger: Logger;
  /** Poll interval in ms. Default 5000. */
  intervalMs?: number;
}

export class EventPoller {
  readonly bus: TypedEmitter;
  private stopped = false;
  private timer: NodeJS.Timeout | null = null;
  private lastTipHash: string | null = null;
  private lastMempoolTxCount = -1;
  private lastMempoolBytes = -1;
  private lastPeerCount = -1;

  constructor(private readonly deps: EventPollerDeps) {
    this.bus = new EventEmitter() as TypedEmitter;
    // Allow many subscribers without the default 10-listener warning.
    this.bus.setMaxListeners(1000);
  }

  start(): void {
    const interval = this.deps.intervalMs ?? 5000;
    this.deps.logger.info({ intervalMs: interval }, "event-poller starting");
    const tick = async () => {
      if (this.stopped) return;
      try {
        await this.pollOnce();
      } catch (err) {
        this.deps.logger.warn({ err }, "event-poller tick failed");
      } finally {
        if (!this.stopped) {
          this.timer = setTimeout(tick, interval);
        }
      }
    };
    // Run once immediately, then schedule.
    void tick();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.bus.removeAllListeners();
  }

  private async pollOnce(): Promise<void> {
    const { rpc } = this.deps;

    // 1. Tip check
    const tipHash = await rpc.getBestBlockHash();
    if (tipHash !== this.lastTipHash) {
      this.lastTipHash = tipHash;
      try {
        const blockRaw = await rpc.getBlockVerbose2(tipHash);
        const block = projectBlock(blockRaw);
        this.bus.emit("event", { type: "block", block });
      } catch (err) {
        this.deps.logger.warn(
          { err, tipHash },
          "event-poller failed to fetch new tip block",
        );
      }
    }

    // 2. Mempool check
    try {
      const mempool = await rpc.getMempoolInfo();
      if (
        mempool.size !== this.lastMempoolTxCount ||
        mempool.bytes !== this.lastMempoolBytes
      ) {
        this.lastMempoolTxCount = mempool.size;
        this.lastMempoolBytes = mempool.bytes;
        this.bus.emit("event", {
          type: "mempool",
          txCount: mempool.size,
          bytes: mempool.bytes,
          minFeeTdcPerKb: mempool.mempoolminfee,
        });
      }
    } catch (err) {
      // Non-fatal; next tick retries.
      this.deps.logger.debug({ err }, "mempool poll failed");
    }

    // 3. Status (peers + difficulty + hashrate) — only emit when
    // peer count changes, since difficulty and hashrate drift slowly.
    try {
      const [network, mining] = await Promise.all([
        rpc.getNetworkInfo(),
        rpc.getMiningInfo(),
      ]);
      if (network.connections !== this.lastPeerCount) {
        this.lastPeerCount = network.connections;
      }
      // Always emit status on every tick; clients can dedupe.
      this.bus.emit("event", {
        type: "status",
        tipHeight: mining.blocks,
        tipHash,
        difficulty: mining.difficulty,
        peers: network.connections,
        networkHashPs: mining.networkhashps,
      });
    } catch (err) {
      this.deps.logger.debug({ err }, "status poll failed");
    }
  }
}
