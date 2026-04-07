/**
 * Zod schemas for the Tidecoin RPC responses we use.
 *
 * These are derived field-by-field from real captures in
 * docs/sample-responses/ — NOT from pretraining. If the node's response
 * contains a field not in the schema, Zod will pass it through in `.passthrough()`
 * mode on the outer envelope but reject extra fields on typed inner objects
 * so we notice shape drift during upgrades.
 *
 * We intentionally do NOT convert TDC amounts to bigint here — that's the
 * job of callers using parseTdcAmount() from @prevblock/shared. The client
 * returns the raw node shape so a developer reading the code can verify
 * the schema against the sample file 1:1.
 */

import { z } from "zod";

export const Hex = z.string().regex(/^[0-9a-fA-F]*$/, "hex expected");
export const Hash32 = z.string().regex(/^[0-9a-f]{64}$/, "32-byte lowercase hex hash expected");

// ---------- getblockchaininfo ----------
export const GetBlockchainInfoSchema = z.object({
  chain: z.enum(["main", "test", "regtest"]),
  blocks: z.number().int().nonnegative(),
  headers: z.number().int().nonnegative(),
  bestblockhash: Hash32,
  difficulty: z.number().nonnegative(),
  mediantime: z.number().int(),
  verificationprogress: z.number(),
  initialblockdownload: z.boolean(),
  chainwork: Hex,
  size_on_disk: z.number().int().nonnegative(),
  pruned: z.boolean(),
  softforks: z.array(
    z.object({
      id: z.string(),
      version: z.number().int(),
      reject: z.object({ status: z.boolean() }),
    }),
  ),
  bip9_softforks: z.record(
    z.object({
      status: z.enum(["defined", "started", "locked_in", "active", "failed"]),
      startTime: z.number().int(),
      timeout: z.number().int(),
      since: z.number().int(),
    }),
  ),
  warnings: z.string(),
});

// ---------- getnetworkinfo ----------
export const GetNetworkInfoSchema = z.object({
  version: z.number().int(),
  subversion: z.string(),
  protocolversion: z.number().int(),
  localservices: z.string(),
  localrelay: z.boolean(),
  timeoffset: z.number().int(),
  networkactive: z.boolean(),
  connections: z.number().int().nonnegative(),
  networks: z.array(
    z.object({
      name: z.enum(["ipv4", "ipv6", "onion"]),
      limited: z.boolean(),
      reachable: z.boolean(),
      proxy: z.string(),
      proxy_randomize_credentials: z.boolean(),
    }),
  ),
  relayfee: z.number().nonnegative(),
  incrementalfee: z.number().nonnegative(),
  localaddresses: z.array(
    z.object({
      address: z.string(),
      port: z.number().int(),
      score: z.number().int(),
    }),
  ),
  warnings: z.string(),
});

// ---------- getmempoolinfo ----------
export const GetMempoolInfoSchema = z.object({
  size: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  usage: z.number().int().nonnegative(),
  maxmempool: z.number().int().nonnegative(),
  mempoolminfee: z.number().nonnegative(),
  minrelaytxfee: z.number().nonnegative(),
});

// ---------- getmininginfo ----------
export const GetMiningInfoSchema = z.object({
  blocks: z.number().int().nonnegative(),
  difficulty: z.number().nonnegative(),
  networkhashps: z.number().nonnegative(),
  pooledtx: z.number().int().nonnegative(),
  chain: z.enum(["main", "test", "regtest"]),
  warnings: z.string(),
});

// ---------- gettxoutsetinfo ----------
export const GetTxOutSetInfoSchema = z.object({
  height: z.number().int().nonnegative(),
  bestblock: Hash32,
  transactions: z.number().int().nonnegative(),
  txouts: z.number().int().nonnegative(),
  bogosize: z.number().int().nonnegative(),
  hash_serialized_2: Hash32,
  disk_size: z.number().int().nonnegative(),
  total_amount: z.number().nonnegative(),
});

// ---------- getblock 2 / getrawtransaction true ----------
const ScriptPubKeySchema = z.object({
  asm: z.string(),
  hex: Hex,
  reqSigs: z.number().int().optional(),
  type: z.string(),
  addresses: z.array(z.string()).optional(),
});

const TxOutSchema = z.object({
  value: z.number(),
  n: z.number().int().nonnegative(),
  scriptPubKey: ScriptPubKeySchema,
});

const TxInCoinbaseSchema = z.object({
  coinbase: Hex,
  sequence: z.number().int(),
});

const TxInNormalSchema = z.object({
  txid: Hash32,
  vout: z.number().int().nonnegative(),
  scriptSig: z.object({ asm: z.string(), hex: Hex }),
  txinwitness: z.array(Hex).optional(),
  sequence: z.number().int(),
});

export const TxInSchema = z.union([TxInCoinbaseSchema, TxInNormalSchema]);

export const DecodedTxSchema = z.object({
  txid: Hash32,
  hash: Hash32,
  version: z.number().int(),
  size: z.number().int().nonnegative(),
  vsize: z.number().int().nonnegative(),
  weight: z.number().int().nonnegative(),
  locktime: z.number().int().nonnegative(),
  vin: z.array(TxInSchema),
  vout: z.array(TxOutSchema),
  hex: Hex.optional(),
  blockhash: Hash32.optional(),
  confirmations: z.number().int().optional(),
  time: z.number().int().optional(),
  blocktime: z.number().int().optional(),
});

export const GetBlockVerbose2Schema = z.object({
  hash: Hash32,
  confirmations: z.number().int(),
  strippedsize: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  weight: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  version: z.number().int(),
  versionHex: z.string(),
  merkleroot: Hash32,
  tx: z.array(DecodedTxSchema),
  time: z.number().int(),
  mediantime: z.number().int(),
  nonce: z.number().int().nonnegative(),
  bits: z.string(),
  difficulty: z.number().nonnegative(),
  chainwork: Hex,
  nTx: z.number().int().nonnegative(),
  previousblockhash: Hash32.optional(),
  nextblockhash: Hash32.optional(),
});

// ---------- JSON-RPC envelope ----------
export const RpcErrorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
});

export const RpcEnvelopeSchema = z.object({
  result: z.unknown(),
  error: RpcErrorSchema.nullable(),
  id: z.union([z.string(), z.number(), z.null()]),
});
