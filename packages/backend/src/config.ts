import { z } from "zod";

/**
 * Environment config for the backend. Read once at startup and frozen.
 * Missing required values crash the process before we bind a port —
 * there is no "default to something plausible" behavior here.
 */
const EnvSchema = z.object({
  TIDECOIN_RPC_URL: z.string().url(),
  TIDECOIN_RPC_USER: z.string().min(1),
  TIDECOIN_RPC_PASSWORD: z.string().min(1),
  TIDECOIN_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  BACKEND_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  BACKEND_HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /**
   * Comma-separated allowed origins for CORS.
   *
   * In dev: leave unset and CORS allows any origin (the Next dev
   * server runs on a different port and uses rewrites anyway).
   * In prod: set to "https://prevblock.com" so only the live
   * frontend can call the API. nginx still terminates TLS in front.
   */
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  /** Optional. If unset the backend uses a NoopCache and hits the node
   *  every time — fine for local dev, not fine for production. */
  REDIS_URL: z.string().url().optional(),

  /** Required for /api/v1/address/:addr (reads indexer state). If
   *  unset the address route is disabled with a 503. Other routes
   *  don't touch Postgres. */
  DATABASE_URL: z.string().optional(),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(): Config {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment config:\n${issues}`);
  }
  return Object.freeze(parsed.data);
}
