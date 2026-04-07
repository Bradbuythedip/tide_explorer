import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { formatTdcAmount, parseTdcAmount } from "@prevblock/shared";

/**
 * /api/v1/mempool/stats   — shape of the pool (fastest path)
 * /api/v1/mempool/recent  — verbose entries ordered by arrival time desc
 *
 * Phase 1 note: both endpoints hit tidecoind directly every time. The
 * stats endpoint is cheap (single getmempoolinfo). /recent calls
 * getrawmempool(true) which returns *everything* in the pool and then
 * we trim client-side. This is fine for the current mempool sizes
 * (<<1000 txs in the observed node) but needs a Redis snapshot cache in
 * the mempool tracker sub-process before production. Marked TODO.
 */
export async function registerMempoolRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/v1/mempool/stats", async () => {
    const info = await app.rpc.getMempoolInfo();
    const minFeeSats = parseTdcAmount(info.mempoolminfee);
    return {
      txCount: info.size,
      bytes: info.bytes,
      usage: info.usage,
      maxMempoolBytes: info.maxmempool,
      minFeeTdcPerKb: info.mempoolminfee,
      minFeeSatsPerKb: minFeeSats.toString(),
      minRelayFeeTdcPerKb: info.minrelaytxfee,
    };
  });

  const RecentQuery = z.object({
    limit: z.coerce.number().int().min(1).max(500).default(50),
  });

  app.get("/api/v1/mempool/recent", async (req, reply) => {
    const query = RecentQuery.safeParse(req.query);
    if (!query.success) return reply.badRequest(query.error.message);

    const verbose = await app.rpc.getRawMempool(true);
    if (Array.isArray(verbose)) {
      // Defensive — rpc-client returns an object in verbose mode.
      return [];
    }
    const entries = Object.entries(verbose).map(([txid, info]) => {
      const feeSats = parseTdcAmount(info.fee);
      return {
        txid,
        wtxid: info.wtxid,
        sizeBytes: info.size,
        arrivalTime: info.time,
        feeSats: feeSats.toString(),
        feeTdc: formatTdcAmount(feeSats),
        ancestorCount: info.ancestorcount,
        descendantCount: info.descendantcount,
        depends: info.depends,
      };
    });
    entries.sort((a, b) => b.arrivalTime - a.arrivalTime);
    return entries.slice(0, query.data.limit);
  });
}
