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

// ---- richlist ----

export interface RichlistEntry {
  rank: number;
  address: string;
  balanceSats: string;
  balanceTdc: string;
  utxoCount: number;
  hashProtectedSats: string;
  pubkeyExposedSats: string;
  bareP2pkSats: string;
}

export interface RichlistResponse {
  minSats: string;
  totalAddresses: number;
  totalSats: string;
  /** Current name for the indexer's total unspent supply. */
  indexedSupplySats?: string;
  /**
   * Legacy name for the same field — backend used to return this
   * until the indexer-db.ts rename. Keep reading it defensively so
   * a frontend-ahead-of-backend deploy doesn't crash the page.
   */
  supplyTotalSats?: string;
  /** Indexer's last_indexed_height. Optional because the legacy
   *  backend shape didn't include it. */
  asOfHeight?: number;
  entries: RichlistEntry[];
}

export function getRichlist(
  minTdc: number,
  limit: number,
): Promise<RichlistResponse | null> {
  return get<RichlistResponse>(
    `/api/v1/richlist?min_tdc=${minTdc}&limit=${limit}`,
  );
}

// ---- quantum supply ----

export interface QuantumSupplyResponse {
  totalSats: string;
  totalTdc: string;
  hashProtectedSats: string;
  hashProtectedTdc: string;
  pubkeyExposedSats: string;
  pubkeyExposedTdc: string;
  bareP2pkSats: string;
  bareP2pkTdc: string;
  unclassifiedSats: string;
  unclassifiedTdc: string;
  asOfHeight: number;
  nodeTipHeight: number;
  blocksBehindTip: number;
  isAtTip: boolean;
}

export function getQuantumSupply(): Promise<QuantumSupplyResponse | null> {
  return get<QuantumSupplyResponse>("/api/v1/quantum/supply");
}

// ---- block ----

export interface BlockSummary {
  height: number;
  hash: string;
  previousHash: string | null;
  nextHash: string | null;
  time: number;
  medianTime: number;
  sizeBytes: number;
  weight: number;
  txCount: number;
  confirmations: number;
  totalOutSats: string;
  totalOutTdc: string;
  falconTxCount: number;
  p2pkFalconTxCount: number;
  txs: BlockTx[];
}

export interface BlockTx {
  txid: string;
  wtxid: string;
  size: number;
  vsize: number;
  weight: number;
  isCoinbase: boolean;
  hasFalconInput: boolean;
  hasP2pkFalconOutput: boolean;
  vin: BlockTxIn[];
  vout: BlockTxOut[];
  totalOutSats: string;
  totalOutTdc: string;
}

export interface BlockTxIn {
  isCoinbase: boolean;
  prevTxid: string | null;
  prevVout: number | null;
  scriptSigHex: string | null;
  coinbaseHex: string | null;
  sequence: number;
  witness: { itemCount: number; items: { index: number; lengthBytes: number; hex: string }[]; looksLikeFalconP2wpkh: boolean } | null;
}

export interface BlockTxOut {
  n: number;
  valueSats: string;
  valueTdc: string;
  scriptType: string;
  address: string | null;
  hash: string | null;
  pubkey: string | null;
  witnessVersion: number | null;
  nodeType: string;
  scriptPubKeyHex: string;
  scriptPubKeyAsm: string;
}

export function getBlock(idOrHeight: string): Promise<BlockSummary | null> {
  return get<BlockSummary>(`/api/v1/block/${idOrHeight}`);
}

// ---- tx ----

export interface TxDetail extends BlockTx {
  blockhash: string | null;
  confirmations: number | null;
  time: number | null;
}

export function getTx(txid: string, blockhash?: string): Promise<TxDetail | null> {
  const qs = blockhash ? `?blockhash=${blockhash}` : "";
  return get<TxDetail>(`/api/v1/tx/${txid}${qs}`);
}

// ---- address ----

export interface AddressUtxo {
  txid: string;
  vout: number;
  valueSats: string;
  valueTdc: string;
  scriptType: string;
  hashProtected: boolean;
  pubkeyRevealedAtHeight: number | null;
}

export interface AddressSummary {
  address: string;
  balanceSats: string;
  balanceTdc: string;
  partition: {
    hashProtectedSats: string;
    hashProtectedTdc: string;
    pubkeyExposedSats: string;
    pubkeyExposedTdc: string;
    bareP2pkSats: string;
    bareP2pkTdc: string;
  };
  utxoCount: number;
  pubkeyEverRevealed: boolean;
  utxos: AddressUtxo[];
}

export function getAddress(addr: string): Promise<AddressSummary | null> {
  return get<AddressSummary>(`/api/v1/address/${addr}`);
}
