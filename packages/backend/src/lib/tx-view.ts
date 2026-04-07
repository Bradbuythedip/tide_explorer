/**
 * Projection helpers that take a node-shape DecodedTx / block and produce
 * the JSON prevblock's API returns.
 *
 * Responsibilities:
 *  - Reclassify every output via classifyScriptPubKey() so we correctly
 *    label `p2pk_falcon` outputs the node calls `nonstandard`.
 *  - Convert every TDC float to bigint sats + fixed-8-decimal string.
 *  - Annotate Falcon witnesses with sizes so the UI can render the
 *    "this is a 690-byte Falcon sig + 898-byte Falcon pubkey" callout
 *    without re-parsing.
 *
 * This layer does NOT perform any chain state lookups (previous outputs,
 * address balances, etc). Those live in the indexer (Phase 2).
 */

import {
  classifyScriptPubKey,
  FALCON,
  formatTdcAmount,
  isCoinbaseInput,
  parseTdcAmount,
  type DecodedTx,
  type DecodedTxIn,
  type DecodedTxOut,
  type GetBlockVerbose2Result,
} from "@prevblock/shared";

export interface TxOutView {
  n: number;
  valueSats: string;
  valueTdc: string;
  scriptType: string;
  address: string | null;
  hash: string | null;
  pubkey: string | null;
  witnessVersion: number | null;
  /** The node's own classification (for debugging/comparison). */
  nodeType: string;
  scriptPubKeyHex: string;
  scriptPubKeyAsm: string;
}

export interface TxInView {
  isCoinbase: boolean;
  prevTxid: string | null;
  prevVout: number | null;
  scriptSigHex: string | null;
  coinbaseHex: string | null;
  sequence: number;
  witness: WitnessView | null;
}

export interface WitnessView {
  itemCount: number;
  items: { index: number; lengthBytes: number; hex: string }[];
  /** True iff the witness looks like [falcon_sig(690), falcon_pubkey(898)]. */
  looksLikeFalconP2wpkh: boolean;
}

export interface TxView {
  txid: string;
  wtxid: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  isCoinbase: boolean;
  hasFalconInput: boolean;
  hasFalconOutput: boolean;
  vin: TxInView[];
  vout: TxOutView[];
  totalOutSats: string;
  totalOutTdc: string;
  blockhash: string | null;
  confirmations: number | null;
  time: number | null;
}

export function projectTx(tx: DecodedTx): TxView {
  const vin = tx.vin.map(projectVin);
  const vout = tx.vout.map(projectVout);
  const totalOut = vout.reduce((acc, o) => acc + BigInt(o.valueSats), 0n);
  const isCoinbase = tx.vin.length === 1 && isCoinbaseInput(tx.vin[0]!);
  const hasFalconInput = vin.some((v) => v.witness?.looksLikeFalconP2wpkh === true);
  const hasFalconOutput = vout.some(
    (o) => o.scriptType === "p2pk_falcon",
  );
  return {
    txid: tx.txid,
    wtxid: tx.hash,
    version: tx.version,
    size: tx.size,
    vsize: tx.vsize,
    weight: tx.weight,
    locktime: tx.locktime,
    isCoinbase,
    hasFalconInput,
    hasFalconOutput,
    vin,
    vout,
    totalOutSats: totalOut.toString(),
    totalOutTdc: formatTdcAmount(totalOut),
    blockhash: tx.blockhash ?? null,
    confirmations: tx.confirmations ?? null,
    time: tx.time ?? null,
  };
}

function projectVin(vin: DecodedTxIn): TxInView {
  if (isCoinbaseInput(vin)) {
    return {
      isCoinbase: true,
      prevTxid: null,
      prevVout: null,
      scriptSigHex: null,
      coinbaseHex: vin.coinbase,
      sequence: vin.sequence,
      witness: null,
    };
  }
  const witness =
    vin.txinwitness && vin.txinwitness.length > 0
      ? projectWitness(vin.txinwitness)
      : null;
  return {
    isCoinbase: false,
    prevTxid: vin.txid,
    prevVout: vin.vout,
    scriptSigHex: vin.scriptSig.hex,
    coinbaseHex: null,
    sequence: vin.sequence,
    witness,
  };
}

function projectWitness(items: string[]): WitnessView {
  const projected = items.map((hex, index) => ({
    index,
    // hex length is 2 chars per byte
    lengthBytes: hex.length / 2,
    hex,
  }));
  const looksLikeFalconP2wpkh =
    projected.length === 2 &&
    projected[0]!.lengthBytes === FALCON.SIGNATURE_SIZE &&
    projected[1]!.lengthBytes === FALCON.PUBLIC_KEY_SIZE;
  return {
    itemCount: projected.length,
    items: projected,
    looksLikeFalconP2wpkh,
  };
}

function projectVout(out: DecodedTxOut): TxOutView {
  const valueSats = parseTdcAmount(out.value);
  const cls = classifyScriptPubKey(out.scriptPubKey.hex);
  const address =
    out.scriptPubKey.addresses && out.scriptPubKey.addresses.length > 0
      ? out.scriptPubKey.addresses[0]!
      : null;
  return {
    n: out.n,
    valueSats: valueSats.toString(),
    valueTdc: formatTdcAmount(valueSats),
    scriptType: cls.type,
    address,
    hash: cls.hash ?? null,
    pubkey: cls.pubkey ?? null,
    witnessVersion: cls.witnessVersion ?? null,
    nodeType: out.scriptPubKey.type,
    scriptPubKeyHex: out.scriptPubKey.hex,
    scriptPubKeyAsm: out.scriptPubKey.asm,
  };
}

// ---- block projection ----

export interface BlockSummary {
  height: number;
  hash: string;
  previousHash: string | null;
  nextHash: string | null;
  time: number;
  medianTime: number;
  sizeBytes: number;
  strippedSizeBytes: number;
  weight: number;
  version: number;
  versionHex: string;
  merkleRoot: string;
  nonce: number;
  bits: string;
  difficulty: number;
  chainwork: string;
  txCount: number;
  confirmations: number;
  /** Total value of all outputs (includes coinbase; does NOT net out fees). */
  totalOutSats: string;
  totalOutTdc: string;
  /** # of txs in this block with at least one Falcon-looking witness. */
  falconTxCount: number;
  /** # of txs with at least one bare-Falcon P2PK output. */
  p2pkFalconTxCount: number;
}

export interface BlockDetail extends BlockSummary {
  txs: TxView[];
}

export function projectBlock(block: GetBlockVerbose2Result): BlockDetail {
  const txs = block.tx.map(projectTx);
  const totalOut = txs.reduce(
    (acc, t) => acc + BigInt(t.totalOutSats),
    0n,
  );
  const falconTxCount = txs.filter((t) => t.hasFalconInput).length;
  const p2pkFalconTxCount = txs.filter((t) => t.hasFalconOutput).length;
  return {
    height: block.height,
    hash: block.hash,
    previousHash: block.previousblockhash ?? null,
    nextHash: block.nextblockhash ?? null,
    time: block.time,
    medianTime: block.mediantime,
    sizeBytes: block.size,
    strippedSizeBytes: block.strippedsize,
    weight: block.weight,
    version: block.version,
    versionHex: block.versionHex,
    merkleRoot: block.merkleroot,
    nonce: block.nonce,
    bits: block.bits,
    difficulty: block.difficulty,
    chainwork: block.chainwork,
    txCount: block.nTx,
    confirmations: block.confirmations,
    totalOutSats: totalOut.toString(),
    totalOutTdc: formatTdcAmount(totalOut),
    falconTxCount,
    p2pkFalconTxCount,
    txs,
  };
}
