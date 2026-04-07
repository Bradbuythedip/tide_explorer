import type { FastifyInstance } from "fastify";

/**
 * GET /api/v1/quantum/supply
 *
 * Three-bucket Falcon partition over the entire UTXO set. The honest
 * answer to "what fraction of TDC is hash-protected vs pubkey-exposed
 * vs bare P2PK." See docs/tidecoin-protocol.md §4 for the bucket
 * definitions; DIRECTIVE.md §0 amendment #3 for why this is the
 * correct partition (vs the draft's wrong ECDSA/Falcon partition).
 *
 * Returns 503 if the indexer is not configured. The route also asks
 * the live node for its tip height so the UI can decide whether the
 * indexer is caught up — when it isn't, the UI shows a "still
 * indexing" banner instead of a fake fraction.
 */
export async function registerQuantumRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/api/v1/quantum/supply", async (_req, reply) => {
    if (app.indexerDb === null) {
      reply.status(503);
      return {
        error: "IndexerUnavailable",
        message:
          "Quantum supply partition requires the indexer. Set DATABASE_URL and run `pnpm -C packages/indexer dev`.",
      };
    }

    const cacheKey = "quantum:supply";
    const cached = await app.cache.get<unknown>(cacheKey);
    if (cached !== null) return cached;

    const [agg, nodeTip] = await Promise.all([
      app.indexerDb.getQuantumSupply(),
      app.rpc.getBlockCount(),
    ]);

    const blocksBehind = Math.max(0, nodeTip - agg.asOfHeight);
    const result = {
      ...agg,
      blocksBehindTip: blocksBehind,
      isAtTip: blocksBehind <= 6,
      nodeTipHeight: nodeTip,
    };

    // 30s TTL — the partition moves slowly even at tip.
    await app.cache.set(cacheKey, "txoutset-30s", result);
    return result;
  });
}
