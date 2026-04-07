/**
 * Redis cache layer for the backend.
 *
 * TTL policy is codified here, in one place, so nobody has to audit
 * individual routes to figure out whether a number is fresh:
 *
 *   confirmed block     : forever (immutable, we never evict)
 *   confirmed tx        : forever (same)
 *   chain status        : 2s     (the dashboard header polls this)
 *   mempool stats       : 2s
 *   fee estimates       : 5s
 *   gettxoutsetinfo     : 30s    (expensive on the node)
 *   address state       : 10s    (Phase 2; invalidated on relevant blocks)
 *
 * This module is optional at runtime. If REDIS_URL is unset the cache
 * falls back to a no-op that still calls the upstream function every
 * time — useful for local development and for isolated tests. The
 * behaviour is never "return stale data silently"; it is either
 * "return real data from Redis" or "bypass the cache and hit the node."
 *
 * Note: no invalidation logic here yet. Phase 2 adds block-arrival hooks
 * that DEL the keys tagged by height. For Phase 1, TTLs are the only
 * freshness mechanism.
 */

import { createClient, type RedisClientType } from "redis";

export type TtlPolicy =
  | "forever"
  | "status-2s"
  | "mempool-stats-2s"
  | "fee-5s"
  | "txoutset-30s"
  | "address-10s";

const TTL_SECONDS: Record<Exclude<TtlPolicy, "forever">, number> = {
  "status-2s": 2,
  "mempool-stats-2s": 2,
  "fee-5s": 5,
  "txoutset-30s": 30,
  "address-10s": 10,
};

export interface Cache {
  /**
   * Read-through cache helper. If the key is present, return the
   * parsed value. Otherwise call `load()`, write the result with the
   * given TTL policy, and return it.
   */
  remember<T>(key: string, ttl: TtlPolicy, load: () => Promise<T>): Promise<T>;
  /** Get a raw cached value without triggering a loader. Returns null on miss. */
  get<T>(key: string): Promise<T | null>;
  /** Set a raw value with a TTL policy. Callers use this when they need
   *  to decide at runtime whether the value is cacheable. */
  set<T>(key: string, ttl: TtlPolicy, value: T): Promise<void>;
  /** Invalidate a specific key. Used by block-arrival hooks in Phase 2. */
  del(key: string): Promise<void>;
  /** Close the underlying connection on shutdown. */
  close(): Promise<void>;
}

/**
 * Bypass cache. Every `remember()` call hits the loader directly.
 * Used when REDIS_URL is not configured.
 */
export class NoopCache implements Cache {
  async remember<T>(
    _key: string,
    _ttl: TtlPolicy,
    load: () => Promise<T>,
  ): Promise<T> {
    return load();
  }
  async get<T>(_key: string): Promise<T | null> {
    return null;
  }
  async set<T>(_key: string, _ttl: TtlPolicy, _value: T): Promise<void> {}
  async del(_key: string): Promise<void> {}
  async close(): Promise<void> {}
}

export class RedisCache implements Cache {
  constructor(private readonly client: RedisClientType) {}

  async remember<T>(
    key: string,
    ttl: TtlPolicy,
    load: () => Promise<T>,
  ): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const value = await load();
    await this.set(key, ttl, value);
    return value;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      await this.client.del(key);
      return null;
    }
  }

  async set<T>(key: string, ttl: TtlPolicy, value: T): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttl === "forever") {
      await this.client.set(key, payload);
    } else {
      await this.client.set(key, payload, { EX: TTL_SECONDS[ttl] });
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

export async function createCache(redisUrl: string | undefined): Promise<Cache> {
  if (!redisUrl) return new NoopCache();
  const client: RedisClientType = createClient({ url: redisUrl });
  client.on("error", (err) => {
    // Log and keep going — Redis going down should not take the backend
    // with it. remember() will still return data, just uncached.
    // eslint-disable-next-line no-console
    console.error("[cache] redis error:", err);
  });
  await client.connect();
  return new RedisCache(client);
}
