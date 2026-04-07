/**
 * Thin server-side API client.
 *
 * Server components import this directly and hit the backend via the
 * internal URL. Client components should go through react-query and
 * fetch from the public /api/v1/* path (Next rewrites it to the
 * backend per next.config.mjs).
 *
 * Every function in this file returns `T | null`. `null` means "the
 * backend is unreachable or returned an error we couldn't recover
 * from." Pages render a degraded state instead of crashing.
 */

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:3001";

export interface StatusResponse {
  chain: {
    name: string;
    tipHeight: number;
    tipHash: string;
    headers: number;
    mediantime: number;
    verificationProgress: number;
    initialBlockDownload: boolean;
    difficulty: number;
    chainwork: string;
    sizeOnDiskBytes: number;
    pruned: boolean;
    targetSpacingSeconds: number;
  };
  network: {
    subversion: string;
    protocolVersion: number;
    connections: number;
    relayFee: number;
    warnings: string | null;
  };
  mining: { networkHashPs: number; difficulty: number };
  mempool: {
    txCount: number;
    bytes: number;
    usage: number;
    maxMempoolBytes: number;
    minFeeTdcPerKb: number;
  };
  supply: {
    utxoCount: number;
    txCount: number;
    totalSats: string;
    totalTdc: string;
    capTdc: string;
  };
  meta: { generatedAt: string };
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      // Server components want no caching — we rely on the backend's
      // Redis layer for TTL. Next's fetch cache would add a second
      // staleness axis we don't want.
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function getStatus(): Promise<StatusResponse | null> {
  return get<StatusResponse>("/api/v1/status");
}
