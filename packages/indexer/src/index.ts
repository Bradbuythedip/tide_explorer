import pino from "pino";
import { TidecoinRpcClient } from "@prevblock/rpc-client";
import { loadConfig } from "./config.js";
import { Db } from "./db.js";
import { IndexerSync } from "./sync.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = pino({ level: config.LOG_LEVEL, name: "prevblock-indexer" });

  const db = Db.fromUrl(config.DATABASE_URL);
  const rpc = new TidecoinRpcClient({
    url: config.TIDECOIN_RPC_URL,
    user: config.TIDECOIN_RPC_USER,
    password: config.TIDECOIN_RPC_PASSWORD,
    timeoutMs: config.TIDECOIN_RPC_TIMEOUT_MS,
  });

  const sync = new IndexerSync({
    db,
    rpc,
    logger,
    pollIntervalMs: config.INDEXER_POLL_INTERVAL_MS,
    batchSize: config.INDEXER_BATCH_SIZE,
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutdown requested");
    sync.stop();
    // Give the current block-index transaction up to 10s to commit
    // before forcing close.
    setTimeout(() => {
      logger.error("shutdown timed out; forcing exit");
      process.exit(1);
    }, 10_000).unref();
    try {
      await db.close();
      await rpc.close();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "shutdown failed");
      process.exit(1);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await sync.run();
  } catch (err) {
    logger.error({ err }, "indexer crashed");
    process.exit(1);
  }
}

void main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
