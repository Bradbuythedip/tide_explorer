/**
 * POST /api/v1/holdem/rpc
 *
 * Thin proxy for Tide Hold'em to call a whitelisted subset of
 * Tidecoin Core RPC methods. Credentials stay server-side; the
 * browser never sees them.
 *
 * Only safe read + transaction-building methods are allowed.
 * Wallet-destructive calls like `sendtoaddress` are blocked.
 */

import type { FastifyInstance } from "fastify";

/** Methods the holdem frontend is allowed to call. */
const ALLOWED_METHODS = new Set([
  // Read-only
  "getbalance",
  "getnewaddress",
  "getblockchaininfo",
  "listunspent",
  "validateaddress",
  "getrawchangeaddress",
  // Transaction building (signing stays on the node)
  "createrawtransaction",
  "signrawtransactionwithwallet",
  "sendrawtransaction",
]);

export async function registerHoldemRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post<{
    Body: { method: string; params?: unknown[] };
  }>("/api/v1/holdem/rpc", async (req, reply) => {
    const { method, params = [] } = req.body ?? {};

    if (!method || typeof method !== "string") {
      reply.status(400);
      return { error: "BadRequest", message: "Missing 'method' in body." };
    }

    if (!ALLOWED_METHODS.has(method)) {
      reply.status(403);
      return {
        error: "Forbidden",
        message: `RPC method '${method}' is not allowed. Permitted: ${[...ALLOWED_METHODS].join(", ")}`,
      };
    }

    try {
      const result = await app.rpc.callRaw(method, params as unknown[]);
      return { result };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown RPC error";
      reply.status(502);
      return { error: "RpcError", message };
    }
  });
}
