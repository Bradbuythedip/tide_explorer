import type { FastifyInstance } from "fastify";

/**
 * Liveness + readiness.
 *
 * - /healthz always returns 200 if the process is up (k8s-style liveness).
 * - /readyz does a cheap getblockcount against the node. If the node is
 *   unreachable, returns 503 so an upstream proxy can stop routing.
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/healthz", async () => ({ ok: true }));

  app.get("/readyz", async (_req, reply) => {
    try {
      const height = await app.rpc.getBlockCount();
      return { ok: true, tipHeight: height };
    } catch (err) {
      reply.status(503);
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}
