import type { FastifyInstance } from "fastify";
import { z } from "zod";

/**
 * GET /api/v1/address/:addr
 *
 * The latency-critical endpoint for DIRECTIVE.md §1 "My Tidecoin."
 *
 * Returns the three-bucket Falcon partition for the given address:
 *   - hashProtected:   pubkey never revealed on chain
 *   - pubkeyExposed:   pubkey was seen in a prior input witness
 *   - bareP2pk:        output type is p2pk_falcon (pubkey was always
 *                      on chain, e.g. genesis)
 *
 * Requires the indexer DB. If DATABASE_URL is unset at backend
 * startup, this endpoint responds 503 with a clear message. We do
 * NOT fabricate data when the indexer isn't connected.
 */
export async function registerAddressRoutes(
  app: FastifyInstance,
): Promise<void> {
  const ParamsSchema = z.object({
    // Accept all four mainnet address families observed/derived from
    // chainparams.cpp:128-135. Bech32 HRP on this chain is 'tbc',
    // NOT 'tdc' — see DIRECTIVE.md §0 amendment #1.
    addr: z
      .string()
      .regex(
        /^(?:tbc1[0-9ac-hj-np-z]{6,87}|[TFV][1-9A-HJ-NP-Za-km-z]{25,40})$/,
        "address must be tbc1..., T..., F..., or V...",
      ),
  });

  app.get("/api/v1/address/:addr", async (req, reply) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) return reply.badRequest(params.error.message);

    if (app.indexerDb === null) {
      reply.status(503);
      return {
        error: "IndexerUnavailable",
        message:
          "Address lookups require the indexer to be connected. Set DATABASE_URL and run the indexer migrations and sync first.",
      };
    }

    const cacheKey = `addr:${params.data.addr}`;
    const cached = await app.cache.get<unknown>(cacheKey);
    if (cached !== null) return cached;

    const summary = await app.indexerDb.getAddressSummary(params.data.addr);
    if (summary === null) {
      return reply.notFound(
        `address ${params.data.addr} has no outputs in the indexer. It may be unused, or the indexer may not be fully caught up.`,
      );
    }

    await app.cache.set(cacheKey, "address-10s", summary);
    return summary;
  });
}
