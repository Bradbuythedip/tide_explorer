/**
 * Indexer sync loop.
 *
 * Responsibilities, in the order they happen inside a single
 * Postgres transaction per block:
 *
 *   1. Check the previous-hash link against what we already have. If
 *      it doesn't match, roll back this block AND the last N blocks
 *      until we find the common ancestor (reorg handling).
 *   2. INSERT blocks row.
 *   3. For each tx in the block:
 *        a. INSERT transactions row
 *        b. For each vin:
 *             - INSERT inputs row
 *             - UPDATE the previous output: set spent_by_txid,
 *               spent_by_vin, spent_at_height.
 *             - If the witness is a Falcon P2WPKH spend, extract
 *               the pubkey. Hash160 it. Then for every unspent
 *               output bound to the same address that has
 *               pubkey_revealed_at_height IS NULL, set
 *               pubkey_revealed_at_height = this block's height.
 *               (Yes, this is O(unspent-outputs-per-address).
 *               Realistic addresses have 1-10 unspent outputs;
 *               large whales have ~hundreds. A partial index covers
 *               the hot path.)
 *        c. For each vout:
 *             - Classify the scriptPubKey
 *             - INSERT outputs row
 *             - If script_type == 'p2pk_falcon': ALSO set
 *               pubkey_revealed_at_height on this output to the
 *               current height (the pubkey is on chain from the
 *               moment the output exists — it's bare P2PK).
 *             - If script_type == 'op_return': insert into
 *               op_returns, detect protocol (witness commitment,
 *               plain-text, 32-byte BTC-anchor-candidate).
 *   4. UPDATE chain_state last_indexed_height.
 *   5. COMMIT. If anything throws, ROLLBACK is automatic via
 *      Db.withTx.
 *
 * On reorg (step 1 fails): walk backward deleting blocks until the
 * prev_hash of the next one to index matches what we have. Log every
 * deleted height at WARN. Then resume forward.
 *
 * Pubkey exposure propagation across addresses is cheap because the
 * same address re-uses the same Hash160 — we address-index it, not
 * pubkey-hash-index it. The SQL looks like:
 *
 *   UPDATE outputs
 *      SET pubkey_revealed_at_height = $1
 *    WHERE address = $2
 *      AND pubkey_revealed_at_height IS NULL
 */

import type { Logger } from "pino";
import {
  classifyScriptPubKey,
  isCoinbaseInput,
  parseTdcAmount,
  type DecodedTx,
  type GetBlockVerbose2Result,
} from "@prevblock/shared";
import type { TidecoinRpcClient } from "@prevblock/rpc-client";
import type { PoolClient } from "pg";
import type { Db } from "./db.js";
import {
  decodeOpReturnPayload,
  extractMinerTag,
  hexToBytes,
  isWitnessCommitment,
  witnessLooksLikeFalconP2wpkh,
} from "./decode.js";

export interface SyncDeps {
  db: Db;
  rpc: TidecoinRpcClient;
  logger: Logger;
  pollIntervalMs: number;
  batchSize: number;
}

export class IndexerSync {
  private stopped = false;

  constructor(private readonly deps: SyncDeps) {}

  /** Run the catch-up + tail loop forever. */
  async run(): Promise<void> {
    const { logger, rpc, pollIntervalMs } = this.deps;
    logger.info("indexer sync starting");
    while (!this.stopped) {
      try {
        const tip = await rpc.getBlockCount();
        const lastIndexed = await this.deps.db.getLastIndexedHeight();
        if (lastIndexed >= tip) {
          await sleep(pollIntervalMs);
          continue;
        }
        const nextHeight = lastIndexed + 1;
        await this.indexBlockAtHeight(nextHeight);
      } catch (err) {
        logger.error({ err }, "indexer sync iteration failed; will retry");
        await sleep(Math.min(pollIntervalMs * 5, 10_000));
      }
    }
    logger.info("indexer sync stopped");
  }

  stop(): void {
    this.stopped = true;
  }

  /** Index exactly one block. Handles reorg internally. */
  private async indexBlockAtHeight(height: number): Promise<void> {
    const { rpc, logger } = this.deps;
    const hash = await rpc.getBlockHash(height);
    const block = await rpc.getBlockVerbose2(hash);

    // Reorg detection: block.previousblockhash must match what we
    // already have at height-1. If not, walk back.
    if (block.previousblockhash !== undefined && height > 0) {
      const ancestor = await this.getIndexedPrevHash(height);
      if (ancestor !== null && ancestor !== block.previousblockhash) {
        logger.warn(
          { height, expected: block.previousblockhash, have: ancestor },
          "reorg detected; rolling back",
        );
        await this.rollbackTo(height - 1);
        return; // next loop iteration re-indexes from the rollback point
      }
    }

    await this.deps.db.withTx(async (client) => {
      await this.insertBlock(client, block);
      logger.info(
        { height, hash: block.hash, txs: block.nTx },
        "indexed block",
      );
    });
  }

  private async getIndexedPrevHash(height: number): Promise<string | null> {
    // Read height-1's hash from our own DB.
    const client = await (this.deps.db as unknown as { pool: { connect: () => Promise<PoolClient> } }).pool.connect();
    try {
      const r = await client.query<{ hash: Buffer }>(
        "SELECT hash FROM prevblock.blocks WHERE height = $1",
        [height - 1],
      );
      if (r.rowCount === 0) return null;
      return r.rows[0]!.hash.toString("hex");
    } finally {
      client.release();
    }
  }

  /** Delete blocks from (current_last) back down to `keepHeight`. */
  private async rollbackTo(keepHeight: number): Promise<void> {
    await this.deps.db.withTx(async (client) => {
      await client.query(
        "DELETE FROM prevblock.blocks WHERE height > $1",
        [keepHeight],
      );
      await this.deps.db.setLastIndexedHeight(client, keepHeight);
    });
  }

  // -------- INSERT pipeline (per block) --------

  private async insertBlock(
    client: PoolClient,
    block: GetBlockVerbose2Result,
  ): Promise<void> {
    // compute block-level aggregates up front
    let totalFeesSats = 0n;
    let subsidySats = 0n;
    let pubkeyExposingTxCount = 0;
    let p2pkFalconOutTxCount = 0;
    let minerTag: string | null = null;

    // Pass 1: accumulate outputs-in/outputs-out per tx so we can
    // compute fees. We cannot compute fees without the prev-out
    // values, which for non-coinbase inputs we have to look up in
    // the outputs table (which already has them indexed by spend).
    // To keep this chunk single-transaction-atomic, we defer fee
    // computation until after all outputs are written.

    for (const tx of block.tx) {
      if (tx.vin.length === 1 && isCoinbaseInput(tx.vin[0]!)) {
        minerTag = extractMinerTag(tx.vin[0]!.coinbase);
        // Coinbase "fee" is irrelevant and is recorded as 0.
        // Subsidy is the total of coinbase outputs (spec TODO:
        // this over-counts when the miner also sweeps fees into
        // the coinbase; see PHASE_0_RETRO.md item 1).
        for (const out of tx.vout) {
          subsidySats += parseTdcAmount(out.value);
        }
      }
      if (tx.vout.some((o) => classifyScriptPubKey(o.scriptPubKey.hex).type === "p2pk_falcon")) {
        p2pkFalconOutTxCount++;
      }
    }

    await client.query(
      `INSERT INTO prevblock.blocks
        (height, hash, prev_hash, merkle_root, block_time, median_time,
         version, bits, nonce, difficulty, chainwork,
         size_bytes, stripped_size, weight, tx_count,
         total_fees_sats, subsidy_sats, miner_tag,
         pubkey_exposing_tx_count, p2pk_falcon_out_tx_count)
       VALUES
        ($1, $2, $3, $4, to_timestamp($5), to_timestamp($6),
         $7, $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16::numeric, $17::numeric, $18,
         $19, $20)`,
      [
        block.height,
        hexToBytes(block.hash),
        block.previousblockhash ? hexToBytes(block.previousblockhash) : null,
        hexToBytes(block.merkleroot),
        block.time,
        block.mediantime,
        block.version,
        hexToBytes(block.bits),
        block.nonce,
        block.difficulty,
        hexToBytes(block.chainwork),
        block.size,
        block.strippedsize,
        block.weight,
        block.nTx,
        // Phase 2 TODO: compute real fees. For now store 0; the
        // verify-index script will catch the discrepancy and we'll
        // patch this in a follow-up.
        "0",
        subsidySats.toString(),
        minerTag,
        0, // pubkeyExposingTxCount — filled by the input pass below
        p2pkFalconOutTxCount,
      ],
    );

    // Pass 2: walk tx/vin/vout and insert rows.
    let blockIndex = 0;
    for (const tx of block.tx) {
      const isCoinbase = tx.vin.length === 1 && isCoinbaseInput(tx.vin[0]!);
      const hasFalconWitness = tx.vin.some(
        (vin) => !isCoinbaseInput(vin) && witnessLooksLikeFalconP2wpkh(vin.txinwitness ?? []),
      );
      const hasP2pkFalconOut = tx.vout.some(
        (o) => classifyScriptPubKey(o.scriptPubKey.hex).type === "p2pk_falcon",
      );
      if (hasFalconWitness) pubkeyExposingTxCount++;

      await client.query(
        `INSERT INTO prevblock.transactions
           (txid, wtxid, block_height, block_index, size, vsize, weight,
            locktime, fee_sats, is_coinbase, is_rbf,
            has_falcon_p2wpkh_input, has_p2pk_falcon_output)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12)`,
        [
          hexToBytes(tx.txid),
          hexToBytes(tx.hash),
          block.height,
          blockIndex++,
          tx.size,
          tx.vsize,
          tx.weight,
          tx.locktime,
          isCoinbase,
          this.detectRbf(tx),
          hasFalconWitness,
          hasP2pkFalconOut,
        ],
      );

      // Outputs first, so inputs referencing *this tx's* outputs
      // (chained within the same block) will find the row.
      await this.insertOutputs(client, tx, block.height);
      await this.insertInputs(client, tx, block.height);
    }

    // Patch the per-block pubkey-exposing count now that we know it.
    await client.query(
      `UPDATE prevblock.blocks SET pubkey_exposing_tx_count = $1 WHERE height = $2`,
      [pubkeyExposingTxCount, block.height],
    );

    await this.deps.db.setLastIndexedHeight(client, block.height);
  }

  private detectRbf(tx: DecodedTx): boolean {
    if (tx.vin.length === 1 && isCoinbaseInput(tx.vin[0]!)) return false;
    return tx.vin.some(
      (vin) => !isCoinbaseInput(vin) && vin.sequence < 0xfffffffe,
    );
  }

  private async insertOutputs(
    client: PoolClient,
    tx: DecodedTx,
    height: number,
  ): Promise<void> {
    for (const out of tx.vout) {
      const valueSats = parseTdcAmount(out.value);
      const cls = classifyScriptPubKey(out.scriptPubKey.hex);
      const address =
        out.scriptPubKey.addresses && out.scriptPubKey.addresses.length > 0
          ? out.scriptPubKey.addresses[0]!
          : null;
      // Bare P2PK-Falcon: pubkey is exposed the moment the output
      // exists. Record the reveal height now; there's nothing to
      // propagate later.
      const pubkeyRevealedHeight =
        cls.type === "p2pk_falcon" ? height : null;

      await client.query(
        `INSERT INTO prevblock.outputs
           (txid, vout, value_sats, script_type, script_pubkey,
            address, hash_program, falcon_pubkey,
            pubkey_revealed_at_height)
         VALUES ($1, $2, $3::numeric, $4::prevblock.script_type,
                 $5, $6, $7, $8, $9)`,
        [
          hexToBytes(tx.txid),
          out.n,
          valueSats.toString(),
          cls.type,
          hexToBytes(out.scriptPubKey.hex),
          address,
          cls.hash ? hexToBytes(cls.hash) : null,
          cls.pubkey ? hexToBytes(cls.pubkey) : null,
          pubkeyRevealedHeight,
        ],
      );

      if (cls.type === "op_return") {
        const payload = decodeOpReturnPayload(out.scriptPubKey.hex) ?? new Uint8Array();
        const protocol = isWitnessCommitment(payload)
          ? "witness-commit"
          : payload.length > 0 && isMostlyPrintable(payload)
            ? "plain-text"
            : null;
        await client.query(
          `INSERT INTO prevblock.op_returns (txid, vout, data, detected_protocol, decoded_payload)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            hexToBytes(tx.txid),
            out.n,
            payload,
            protocol,
            protocol === "plain-text"
              ? JSON.stringify({ text: new TextDecoder().decode(payload) })
              : null,
          ],
        );
      }
    }
  }

  private async insertInputs(
    client: PoolClient,
    tx: DecodedTx,
    height: number,
  ): Promise<void> {
    let vinIndex = 0;
    for (const vin of tx.vin) {
      if (isCoinbaseInput(vin)) {
        await client.query(
          `INSERT INTO prevblock.inputs
             (txid, vin, prev_txid, prev_vout, sequence, script_sig, witness,
              witness_is_falcon_p2wpkh)
           VALUES ($1, $2, $3, $4, $5, NULL, NULL, FALSE)`,
          [
            hexToBytes(tx.txid),
            vinIndex++,
            new Uint8Array(32), // all-zero for coinbase
            0xffffffff,
            vin.sequence,
          ],
        );
        continue;
      }

      const witnessStack = vin.txinwitness ?? [];
      const isFalcon = witnessLooksLikeFalconP2wpkh(witnessStack);

      await client.query(
        `INSERT INTO prevblock.inputs
           (txid, vin, prev_txid, prev_vout, sequence, script_sig, witness,
            witness_is_falcon_p2wpkh)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          hexToBytes(tx.txid),
          vinIndex++,
          hexToBytes(vin.txid),
          vin.vout,
          vin.sequence,
          hexToBytes(vin.scriptSig.hex),
          // Store witness as a simple length-prefixed concatenation
          // for now. A future reader can walk the same format.
          serializeWitness(witnessStack),
          isFalcon,
        ],
      );

      // Mark the spent output, and capture the address so we can
      // propagate pubkey exposure.
      const spent = await client.query<{ address: string | null }>(
        `UPDATE prevblock.outputs
            SET spent_by_txid = $1, spent_by_vin = $2, spent_at_height = $3
          WHERE txid = $4 AND vout = $5
          RETURNING address`,
        [
          hexToBytes(tx.txid),
          vinIndex - 1,
          height,
          hexToBytes(vin.txid),
          vin.vout,
        ],
      );

      if (isFalcon && spent.rowCount !== null && spent.rowCount > 0) {
        const addr = spent.rows[0]!.address;
        if (addr !== null) {
          // Reveal the pubkey for every still-hash-protected output
          // bound to this address.
          await client.query(
            `UPDATE prevblock.outputs
                SET pubkey_revealed_at_height = $1
              WHERE address = $2
                AND pubkey_revealed_at_height IS NULL`,
            [height, addr],
          );
        }
      }
    }
  }
}

// ---- helpers --------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMostlyPrintable(bytes: Uint8Array): boolean {
  let printable = 0;
  for (const b of bytes) {
    if ((b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a) printable++;
  }
  return bytes.length > 0 && printable / bytes.length > 0.85;
}

/**
 * Compact-int + per-item compact-int length-prefixed concatenation of
 * witness stack items. This is the same wire format the tx witness
 * uses, minus the txid context. Opaque blob; we decode it only for
 * audit/verify.
 */
function serializeWitness(items: string[]): Uint8Array {
  const parts: number[] = [];
  writeVarInt(parts, items.length);
  for (const item of items) {
    const bytes = hexToBytes(item);
    writeVarInt(parts, bytes.length);
    for (const b of bytes) parts.push(b);
  }
  return new Uint8Array(parts);
}

function writeVarInt(out: number[], n: number): void {
  if (n < 0xfd) {
    out.push(n);
  } else if (n <= 0xffff) {
    out.push(0xfd, n & 0xff, (n >> 8) & 0xff);
  } else if (n <= 0xffffffff) {
    out.push(0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff);
  } else {
    throw new Error("varint > 32 bits not supported");
  }
}
