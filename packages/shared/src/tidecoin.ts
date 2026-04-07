/**
 * Tidecoin-specific constants derived from source.
 *
 * All values cite a line in docs/source-extracts/chainparams.cpp or the
 * tidecoin.conf captured in docs/sample-responses/00-conf.txt.
 */

export const TIDECOIN_MAINNET = {
  /** chainparams.cpp:115 — matches getblockhash 0 on the live node. */
  genesisHash:
    "480ecc7602d8989f32483377ed66381c391dda6215aeef9e80486a7fd3018075",
  /** chainparams.cpp:74. */
  powTargetSpacingSeconds: 60,
  /** chainparams.cpp:73. */
  powTargetTimespanSeconds: 5 * 24 * 60 * 60,
  /** chainparams.cpp:66. TODO: verify actual emission curve against a
   * range of heights; the tip subsidy 0.625 at h=2,503,300 does NOT match
   * a clean 50 / 2^n halving schedule. See PHASE_0_RETRO.md item #5. */
  subsidyHalvingInterval: 262_800,
  /** chainparams.cpp:128-135 — mainnet base58 version bytes. */
  base58Prefixes: {
    /** 'F…' addresses — P2PKH-Falcon. Not yet sampled on chain. */
    pubkeyAddress: 33,
    /** 'V…' addresses — primary P2SH prefix. Not yet sampled on chain. */
    scriptAddress: 70,
    /** 'T…' addresses — secondary P2SH prefix. This is what's actually
     *  used on mainnet (every P2SH we've observed). */
    scriptAddress2: 65,
    /** '7…' WIF private keys. Out of scope for an explorer. */
    secretKey: 125,
  },
  /** chainparams.cpp:135 — bech32 HRP is "tbc", so native segwit addresses
   *  are `tbc1q...`. NOT "tdc1q" as the original v2 spec assumed. */
  bech32Hrp: "tbc",
  /**
   * Base fork lineage. Informational; affects which RPC shapes we expect.
   * See docs/rpc-surface.md.
   */
  baseCoreVersion: "0.18.3",
  /** `getbestblockhash` / `getblockcount` poll interval. No ZMQ available. */
  pollIntervalMs: 1000,
} as const;

/**
 * Shape of `getblockchaininfo` as returned by Tidecoin 0.18.3.
 * Source: docs/sample-responses/02-getblockchaininfo.json (verbatim).
 *
 * NOTE the 0.18-era quirks: `softforks` is an *array* of
 * `{id, version, reject}`, and BIP9 state lives separately under
 * `bip9_softforks`. Modern Bitcoin Core (>= 0.19) merged these into a
 * single `softforks` object keyed by name. Don't copy a "modern" type
 * from memory — use this one.
 */
export interface GetBlockchainInfoResult {
  chain: "main" | "test" | "regtest";
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  mediantime: number;
  verificationprogress: number;
  initialblockdownload: boolean;
  chainwork: string;
  size_on_disk: number;
  pruned: boolean;
  softforks: Array<{
    id: string;
    version: number;
    reject: { status: boolean };
  }>;
  bip9_softforks: Record<
    string,
    {
      status: "defined" | "started" | "locked_in" | "active" | "failed";
      startTime: number;
      timeout: number;
      since: number;
    }
  >;
  warnings: string;
}

/** Source: docs/sample-responses/01-getnetworkinfo.json */
export interface GetNetworkInfoResult {
  version: number;
  subversion: string;
  protocolversion: number;
  localservices: string;
  localrelay: boolean;
  timeoffset: number;
  networkactive: boolean;
  connections: number;
  networks: Array<{
    name: "ipv4" | "ipv6" | "onion";
    limited: boolean;
    reachable: boolean;
    proxy: string;
    proxy_randomize_credentials: boolean;
  }>;
  relayfee: number;
  incrementalfee: number;
  localaddresses: Array<{ address: string; port: number; score: number }>;
  warnings: string;
}

/** Source: docs/sample-responses/03-getmempoolinfo.json */
export interface GetMempoolInfoResult {
  size: number;
  bytes: number;
  usage: number;
  maxmempool: number;
  mempoolminfee: number;
  minrelaytxfee: number;
}

/** Source: docs/sample-responses/07-gettxoutsetinfo.json */
export interface GetTxOutSetInfoResult {
  height: number;
  bestblock: string;
  transactions: number;
  txouts: number;
  bogosize: number;
  hash_serialized_2: string;
  disk_size: number;
  /** Decimal TDC string. Parse with parseTdcAmount() before arithmetic. */
  total_amount: number;
}

/** Source: docs/sample-responses/04-getmininginfo.json */
export interface GetMiningInfoResult {
  blocks: number;
  difficulty: number;
  networkhashps: number;
  pooledtx: number;
  chain: "main" | "test" | "regtest";
  warnings: string;
}

/**
 * Source: docs/sample-responses/{11-genesis-block.json, 21-tip-block.json,
 * 31-busy-block.json}. verbosity=2 inlines decoded txs.
 */
export interface GetBlockVerbose2Result {
  hash: string;
  confirmations: number;
  strippedsize: number;
  size: number;
  weight: number;
  height: number;
  version: number;
  versionHex: string;
  merkleroot: string;
  tx: DecodedTx[];
  time: number;
  mediantime: number;
  nonce: number;
  bits: string;
  difficulty: number;
  chainwork: string;
  nTx: number;
  previousblockhash?: string;
  nextblockhash?: string;
}

/**
 * Source: docs/sample-responses/70-{cb,big,sml}.json and inline in
 * the `tx` array of a getblock 2 response. Identical shape either way.
 */
export interface DecodedTx {
  txid: string;
  /** differs from txid for segwit txs (wtxid); see 70-big.json */
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin: DecodedTxIn[];
  vout: DecodedTxOut[];
  /** Hex of the serialized tx; only present in getrawtransaction, not in getblock 2. */
  hex?: string;
  blockhash?: string;
  confirmations?: number;
  time?: number;
  blocktime?: number;
}

export type DecodedTxIn = DecodedTxInCoinbase | DecodedTxInNormal;

export interface DecodedTxInCoinbase {
  /** Hex of the coinbase scriptSig. Present ONLY for coinbase inputs. */
  coinbase: string;
  sequence: number;
}

export interface DecodedTxInNormal {
  txid: string;
  vout: number;
  scriptSig: { asm: string; hex: string };
  /** Present if the input spends a witness output. Stack items as hex strings. */
  txinwitness?: string[];
  sequence: number;
}

export interface DecodedTxOut {
  /** Decimal TDC as a JSON number. Parse with parseTdcAmount() before storage. */
  value: number;
  n: number;
  scriptPubKey: DecodedScriptPubKey;
}

export interface DecodedScriptPubKey {
  asm: string;
  hex: string;
  reqSigs?: number;
  /**
   * The node's own classification. **DO NOT TRUST** for bare-Falcon P2PK —
   * see docs/tidecoin-protocol.md §3.1. The indexer reclassifies every
   * output using the rules in packages/shared/src/script-types.ts.
   */
  type: string;
  addresses?: string[];
}

/**
 * Narrowing helper so downstream code doesn't have to remember whether a
 * vin is coinbase.
 */
export function isCoinbaseInput(
  vin: DecodedTxIn,
): vin is DecodedTxInCoinbase {
  return "coinbase" in vin;
}
