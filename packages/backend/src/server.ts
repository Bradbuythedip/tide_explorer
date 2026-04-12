import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";
import { TidecoinRpcClient } from "@prevblock/rpc-client";
import type { Config } from "./config.js";
import type { Cache } from "./lib/cache.js";
import type { IndexerDb } from "./lib/indexer-db.js";
import { EventPoller } from "./lib/event-poller.js";
import { WsHub } from "./lib/ws-hub.js";
import { registerStatusRoutes } from "./routes/status.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerBlockRoutes } from "./routes/block.js";
import { registerTxRoutes } from "./routes/tx.js";
import { registerMempoolRoutes } from "./routes/mempool.js";
import { registerAddressRoutes } from "./routes/address.js";
import { registerRichlistRoutes } from "./routes/richlist.js";
import { registerBlocksRecentRoutes } from "./routes/blocks-recent.js";
import { registerWsRoutes } from "./routes/ws.js";

export interface BuildServerDeps {
  config: Config;
  rpc: TidecoinRpcClient;
  cache: Cache;
  indexerDb: IndexerDb | null;
}

export interface BuiltServer {
  app: FastifyInstance;
  poller: EventPoller;
  hub: WsHub;
}

/**
 * Build a Fastify instance + its event poller + ws hub. The poller
 * and hub are returned alongside the Fastify app so the process-level
 * startup code can start/stop them in sync with app.listen/close.
 */
export async function buildServer(
  deps: BuildServerDeps,
): Promise<BuiltServer> {
  const { config, rpc, cache, indexerDb } = deps;

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    trustProxy: true,
    disableRequestLogging: false,
  });

  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: false });

  // CORS: in prod set CORS_ALLOWED_ORIGINS to a comma-separated list
  // of full origins. Dev (env unset) allows all.
  const corsOrigin = config.CORS_ALLOWED_ORIGINS
    ? config.CORS_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : true;
  await app.register(cors, { origin: corsOrigin });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    hook: "preHandler",
  });

  // WebSocket support. Must be registered BEFORE routes that use it.
  await app.register(websocket, {
    options: {
      // Reasonable frame size limit — our messages are small JSON
      // objects, anything over 64KB is almost certainly abuse.
      maxPayload: 64 * 1024,
    },
  });

  app.decorate("rpc", rpc);
  app.decorate("appConfig", config);
  app.decorate("cache", cache);
  app.decorate("indexerDb", indexerDb);

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, "request failed");
    if (reply.sent) return;
    reply.status(err.statusCode ?? 500).send({
      error: err.name,
      message: err.message,
    });
  });

  // Event poller — polls the node every 5s, emits events internally.
  // WsHub subscribes to it and fans out to WebSocket clients.
  const poller = new EventPoller({ rpc, logger: app.log });
  const hub = new WsHub({ poller, logger: app.log });

  // HTTP routes
  await registerHealthRoutes(app);
  await registerStatusRoutes(app);
  await registerBlockRoutes(app);
  await registerBlocksRecentRoutes(app);
  await registerTxRoutes(app);
  await registerMempoolRoutes(app);
  await registerAddressRoutes(app);
  await registerRichlistRoutes(app);

  // WebSocket route (must come after websocket plugin registration)
  await registerWsRoutes(app, hub);

  // Start the poller once Fastify is ready to accept connections.
  app.addHook("onReady", async () => {
    poller.start();
  });
  // Stop it cleanly on shutdown.
  app.addHook("onClose", async () => {
    await poller.stop();
  });

  return { app, poller, hub };
}

declare module "fastify" {
  interface FastifyInstance {
    rpc: TidecoinRpcClient;
    appConfig: Config;
    cache: Cache;
    indexerDb: IndexerDb | null;
  }
}
