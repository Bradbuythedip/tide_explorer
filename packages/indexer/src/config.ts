import { z } from "zod";

/**
 * Indexer config. Same Zod-failfast pattern as the backend.
 *
 * The indexer is a separate process from the backend. It owns:
 *  - the Postgres connection pool
 *  - the tidecoind RPC connection (its own pool; backend has one too)
 *  - the sync loop
 *
 * It does NOT own: HTTP. It writes to Postgres and the backend reads
 * from Postgres. Inter-process notification in Phase 2 is Postgres
 * LISTEN/NOTIFY on an "indexer_tip" channel; the backend subscribes
 * and invalidates cache keys when the tip advances.
 */
const EnvSchema = z.object({
  TIDECOIN_RPC_URL: z.string().url(),
  TIDECOIN_RPC_USER: z.string().min(1),
  TIDECOIN_RPC_PASSWORD: z.string().min(1),
  TIDECOIN_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

  DATABASE_URL: z.string().min(1),

  /** How often to poll getbestblockhash when caught up. */
  INDEXER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
  /** How many blocks to process in a single Postgres transaction. */
  INDEXER_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  /** Upper bound on blocks per second; throttles the catch-up loop so
   *  we don't starve the node during IBD. Set to 0 to disable. */
  INDEXER_MAX_BLOCKS_PER_SEC: z.coerce.number().nonnegative().default(0),

  /**
   * Log a per-block "indexed block" line every N blocks during
   * catch-up. At tip (within 6 blocks) we log every block regardless,
   * because that's the operationally interesting case. Set to 1 to
   * get the old per-block firehose; set to 1000 if you're catching
   * up on a Railway dashboard and don't want to pay for log storage.
   */
  INDEXER_LOG_EVERY: z.coerce.number().int().positive().default(100),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

export type IndexerConfig = z.infer<typeof EnvSchema>;

export function loadConfig(): IndexerConfig {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid indexer environment config:\n${issues}`);
  }
  return Object.freeze(parsed.data);
}
