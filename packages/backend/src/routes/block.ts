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

    try {
      const block = await app.rpc.getBlockVerbose2(hash);
      return projectBlock(block);
    } catch (err) {
      return reply.notFound(`block ${hash} not found: ${errMsg(err)}`);
    }
  });
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
