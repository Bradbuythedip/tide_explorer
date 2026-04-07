import { TidecoinRpcClient } from "@prevblock/rpc-client";
import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";
import { createCache } from "./lib/cache.js";
import { createIndexerDb } from "./lib/indexer-db.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const rpc = new TidecoinRpcClient({
    url: config.TIDECOIN_RPC_URL,
    user: config.TIDECOIN_RPC_USER,
    password: config.TIDECOIN_RPC_PASSWORD,
    timeoutMs: config.TIDECOIN_RPC_TIMEOUT_MS,
  });

  const cache = await createCache(config.REDIS_URL);
  const indexerDb = createIndexerDb(config.DATABASE_URL);

  const app = await buildServer({ config, rpc, cache, indexerDb });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutdown requested");
    try {
      await app.close();
      await cache.close();
      if (indexerDb !== null) await indexerDb.close();
      await rpc.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "shutdown failed");
      process.exit(1);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ host: config.BACKEND_HOST, port: config.BACKEND_PORT });
  } catch (err) {
    app.log.error({ err }, "failed to bind port");
    process.exit(1);
  }
}

void main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
