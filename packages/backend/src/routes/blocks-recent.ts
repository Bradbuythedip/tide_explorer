import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { projectBlock, type BlockDetail } from "../lib/tx-view.js";

/**
 * GET /api/v1/blocks/recent?limit=N
 *
 * Returns a compact summary of the last N blocks (default 15, max
 * 50) ordered newest-first. This is the initial-fetch endpoint for
 * the live 'Recent blocks' panel on the dashboard — after the
 * initial load, the panel switches to the WebSocket 'blocks'
 * channel for live updates.
 *
 * We call the node directly (not the indexer) so the response is
 * always the live chain tip, not the in-progress indexer state.
 * Each block fetch is one getblockhash + one getblock, cached
 * forever once confirmations >= 6 via the standard Redis cache
 * path used by /block/:id.
 *
 * The compact shape here drops the per-tx breakdown (which the
 * /block/:id route returns in full) because the dashboard only
 * needs height/hash/time/tx count/size/total-out per row. Full
 * block detail is one click away via the per-row link.
 */

export interface RecentBlockSummary {
  height: number;
  hash: string;
  time: number;
  txCount: number;
  sizeBytes: number;
  weight: number;
  totalOutTdc: string;
  minerTag: string | null;
  hasFalconInputs: boolean;
  hasP2pkFalconOut: boolean;
}

function toSummary(block: BlockDetail): RecentBlockSummary {
  return {
    height: block.height,
    hash: block.hash,
    time: block.time,
    txCount: block.txCount,
    sizeBytes: block.sizeBytes,
    weight: block.weight,
    totalOutTdc: block.totalOutTdc,
    // Miner tag is derived during indexer insert but NOT present in
    // the BlockDetail projection. Leave null here — the backend
    // could decode the coinbase itself but it's cheap to add later.
    minerTag: null,
    hasFalconInputs: block.falconTxCount > 0,
    hasP2pkFalconOut: block.p2pkFalconTxCount > 0,
  };
}

export async function registerBlocksRecentRoutes(
  app: FastifyInstance,
): Promise<void> {
  const QuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(15),
  });

  app.get("/api/v1/blocks/recent", async (req, reply) => {
    const query = QuerySchema.safeParse(req.query);
    if (!query.success) return reply.badRequest(query.error.message);

    const limit = query.data.limit;

    try {
      const tip = await app.rpc.getBlockCount();
      const heights: number[] = [];
      for (let i = 0; i < limit && tip - i >= 0; i++) {
        heights.push(tip - i);
      }

      // Fetch block hashes in parallel, then fetch each full block in
      // parallel. Node RPC is cheap and tolerates concurrency.
      const hashes = await Promise.all(
        heights.map((h) => app.rpc.getBlockHash(h)),
      );

      const blocks = await Promise.all(
        hashes.map(async (hash) => {
          // Cache confirmed blocks forever, tip blocks bypass — same
          // policy as /block/:idOrHeight.
          const cacheKey = `block:${hash}`;
          const cached = await app.cache.get<BlockDetail>(cacheKey);
          if (cached !== null) return cached;
          const raw = await app.rpc.getBlockVerbose2(hash);
          const projected = projectBlock(raw);
          if (raw.confirmations >= 6) {
            await app.cache.set(cacheKey, "forever", projected);
          }
          return projected;
        }),
      );

      return blocks.map(toSummary);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "recent blocks fetch failed");
      reply.status(503);
      return {
        error: "NodeUnreachable",
        message: `Failed to fetch recent blocks from the node: ${message}`,
      };
    }
  });
}
