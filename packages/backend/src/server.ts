import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { TidecoinRpcClient } from "@prevblock/rpc-client";
import type { Config } from "./config.js";
import { registerStatusRoutes } from "./routes/status.js";
import { registerHealthRoutes } from "./routes/health.js";

export interface BuildServerDeps {
  config: Config;
  rpc: TidecoinRpcClient;
}

/**
 * Build a Fastify instance. Factory shape so tests can pass a mock rpc
 * later (for the rpc-client package's own tests; not for the backend's
 * route tests — those hit a real regtest node per Phase 1 acceptance).
 */
export async function buildServer(
  deps: BuildServerDeps,
): Promise<FastifyInstance> {
  const { config, rpc } = deps;

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
      ],
    },
    trustProxy: true,
    disableRequestLogging: false,
  });

  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    hook: "preHandler",
  });

  app.decorate("rpc", rpc);
  app.decorate("appConfig", config);

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, "request failed");
    if (reply.sent) return;
    reply.status(err.statusCode ?? 500).send({
      error: err.name,
      message: err.message,
    });
  });

  await registerHealthRoutes(app);
  await registerStatusRoutes(app);

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    rpc: TidecoinRpcClient;
    appConfig: Config;
  }
}
