import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { projectBlock } from "../lib/tx-view.js";

/**
 * GET /api/v1/block/:idOrHeight
 *
 * :idOrHeight is either a 64-char lowercase hex hash or a non-negative
 * integer height. Anything else 400s.
 */
export async function registerBlockRoutes(app: FastifyInstance): Promise<void> {
  const ParamsSchema = z.object({ idOrHeight: z.string().min(1) });

  app.get("/api/v1/block/:idOrHeight", async (req, reply) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) return reply.badRequest(params.error.message);

    const raw = params.data.idOrHeight;
    let hash: string;
    if (/^[0-9a-f]{64}$/.test(raw)) {
      hash = raw;
    } else if (/^\d+$/.test(raw)) {
      const height = Number(raw);
      if (!Number.isSafeInteger(height) || height < 0) {
        return reply.badRequest("invalid height");
      }
      try {
        hash = await app.rpc.getBlockHash(height);
      } catch (err) {
        return reply.notFound(
          `block at height ${height} not found: ${errMsg(err)}`,
        );
      }
    } else {
      return reply.badRequest(
        "block id must be a 64-char lowercase hex hash or a non-negative integer height",
      );
    }

    // Confirmed blocks (>=6 deep) are immutable on this chain and
    // cached forever keyed by hash. A reorg produces a distinct
    // hash, so the cache is naturally reorg-safe. Blocks within 6
    // of the tip bypass the cache — they might still move.
    const cacheKey = `block:${hash}`;
    const cached = await app.cache.get<ReturnType<typeof projectBlock>>(
      cacheKey,
    );
    if (cached !== null) return cached;

    try {
      const block = await app.rpc.getBlockVerbose2(hash);
      const projected = projectBlock(block);
      if (block.confirmations >= 6) {
        await app.cache.set(cacheKey, "forever", projected);
      }
      return projected;
    } catch (err) {
      return reply.notFound(`block ${hash} not found: ${errMsg(err)}`);
    }
  });
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
