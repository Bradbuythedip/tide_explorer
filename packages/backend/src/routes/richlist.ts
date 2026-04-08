import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { formatTdcAmount, parseTdcAmount } from "@prevblock/shared";

/**
 * GET /api/v1/richlist?min_tdc=1000&limit=500
 *
 * Lists every address whose balance meets the threshold, ordered by
 * balance desc. Each entry includes the per-address three-bucket
 * Falcon partition so the UI can render a stacked-bar without a
 * second round-trip.
 *
 * Honest about its own freshness: returns 503 with a clear message if
 * the indexer DB is not configured. Returns the indexer's
 * last_indexed_height inside the payload so the UI can show a
 * "computed at height N" footnote.
 */
export async function registerRichlistRoutes(
  app: FastifyInstance,
): Promise<void> {
  const QuerySchema = z.object({
    min_tdc: z.coerce.number().nonnegative().default(0),
    // Default to top 500 addresses by balance. The 10000 cap is a
    // safety rail against an accidental 'limit=2147483647' that
    // would try to materialise the whole UTXO set in memory.
    limit: z.coerce.number().int().min(1).max(10000).default(500),
  });

  app.get("/api/v1/richlist", async (req, reply) => {
    const query = QuerySchema.safeParse(req.query);
    if (!query.success) return reply.badRequest(query.error.message);

    if (app.indexerDb === null) {
      reply.status(503);
      return {
        error: "IndexerUnavailable",
        message:
          "Richlist requires the indexer. Set DATABASE_URL and run `pnpm -C packages/indexer dev`.",
      };
    }

    const minSats = parseTdcAmount(query.data.min_tdc);
    const cacheKey = `richlist:${minSats}:${query.data.limit}`;
    const cached = await app.cache.get<unknown>(cacheKey);
    if (cached !== null) return cached;

    const result = await app.indexerDb.getRichlist(minSats, query.data.limit);

    // Same 10s TTL as /address. Richlist movement is slow.
    await app.cache.set(cacheKey, "address-10s", result);
    return result;
  });
}
