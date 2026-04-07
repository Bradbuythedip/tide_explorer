import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { projectTx } from "../lib/tx-view.js";

/**
 * GET /api/v1/tx/:txid
 *
 * Requires either txindex=1 on the node OR a ?blockhash=... query param
 * pointing at the containing block. Returns a TxView with:
 *   - classifier-corrected script_type on every output (so
 *     `p2pk_falcon` outputs are labelled correctly even though the
 *     node itself reports them as `nonstandard`)
 *   - witness layout annotated with Falcon sig/pubkey sizes
 *   - bigint sats + fixed-decimal TDC for every amount
 */
export async function registerTxRoutes(app: FastifyInstance): Promise<void> {
  const ParamsSchema = z.object({
    txid: z.string().regex(/^[0-9a-f]{64}$/, "txid must be 64-char lowercase hex"),
  });
  const QuerySchema = z.object({
    blockhash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  });

  app.get("/api/v1/tx/:txid", async (req, reply) => {
    const params = ParamsSchema.safeParse(req.params);
    if (!params.success) return reply.badRequest(params.error.message);
    const query = QuerySchema.safeParse(req.query);
    if (!query.success) return reply.badRequest(query.error.message);

    const cacheKey = `tx:${params.data.txid}`;
    const cached = await app.cache.get<ReturnType<typeof projectTx>>(cacheKey);
    if (cached !== null) return cached;

    try {
      const decoded = await app.rpc.getRawTransactionDecoded(
        params.data.txid,
        query.data.blockhash,
      );
      const projected = projectTx(decoded);
      // Only cache confirmed, deeply-buried txs. Mempool txs change
      // when they get confirmed; near-tip txs can be reorged.
      if (
        decoded.confirmations !== undefined &&
        decoded.confirmations >= 6
      ) {
        await app.cache.set(cacheKey, "forever", projected);
      }
      return projected;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Tidecoin's getrawtransaction returns code -5 for "not found".
      if (/-5/.test(msg) || /No such mempool/.test(msg)) {
        return reply.notFound(`tx ${params.data.txid} not found: ${msg}`);
      }
      throw err;
    }
  });
}
