/**
 * Postgres access for the indexer.
 *
 * Design:
 *  - One pg.Pool owned by the process, closed on shutdown.
 *  - Every write happens inside a BEGIN/COMMIT; a block is either
 *    fully indexed or not at all. No partial state on the floor.
 *  - Typed helper wrappers around the few SQL statements we use.
 *    Prepared statements via pg's built-in LRU.
 *
 * The SQL schema is in sql/migrations/001_init.sql. This file does not
 * duplicate the column list — it just types the row shapes that come
 * back and trusts the migration.
 */

import { Pool, type PoolClient } from "pg";

export interface DbBlockRow {
  height: number;
  hash: Uint8Array;
  prev_hash: Uint8Array | null;
  merkle_root: Uint8Array;
  block_time: Date;
  median_time: Date;
  version: number;
  bits: Uint8Array;
  nonce: number;
  difficulty: number;
  chainwork: Uint8Array;
  size_bytes: number;
  stripped_size: number;
  weight: number;
  tx_count: number;
  total_fees_sats: string;
  subsidy_sats: string;
  miner_tag: string | null;
  pubkey_exposing_tx_count: number;
  p2pk_falcon_out_tx_count: number;
}

export interface DbTxRow {
  txid: Uint8Array;
  wtxid: Uint8Array;
  block_height: number;
  block_index: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  fee_sats: string;
  is_coinbase: boolean;
  is_rbf: boolean;
  has_falcon_p2wpkh_input: boolean;
  has_p2pk_falcon_output: boolean;
}

export interface DbOutputRow {
  txid: Uint8Array;
  vout: number;
  value_sats: string;
  script_type: string;
  script_pubkey: Uint8Array;
  address: string | null;
  hash_program: Uint8Array | null;
  falcon_pubkey: Uint8Array | null;
  spent_by_txid: Uint8Array | null;
  spent_by_vin: number | null;
  spent_at_height: number | null;
  pubkey_revealed_at_height: number | null;
}

export interface DbInputRow {
  txid: Uint8Array;
  vin: number;
  prev_txid: Uint8Array;
  prev_vout: number;
  sequence: number;
  script_sig: Uint8Array | null;
  witness: Uint8Array | null;
  witness_is_falcon_p2wpkh: boolean;
}

export class Db {
  constructor(private readonly pool: Pool) {}

  static fromUrl(databaseUrl: string): Db {
    return new Db(new Pool({ connectionString: databaseUrl, max: 8 }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Run `fn` inside a single transaction with the `prevblock` search path set.
   * The transaction commits on success, rolls back on error.
   */
  async withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path TO prevblock, public");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /** Read the last_indexed_height marker. Returns -1 if never set. */
  async getLastIndexedHeight(): Promise<number> {
    const result = await this.pool.query<{ v: string }>(
      "SELECT v::text FROM prevblock.chain_state WHERE k = 'last_indexed_height'",
    );
    if (result.rowCount === 0) return -1;
    const raw = result.rows[0]!.v;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : -1;
  }

  /** Update last_indexed_height inside an existing client transaction. */
  async setLastIndexedHeight(client: PoolClient, height: number): Promise<void> {
    await client.query(
      `INSERT INTO prevblock.chain_state (k, v, updated_at)
         VALUES ('last_indexed_height', $1::jsonb, NOW())
         ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = NOW()`,
      [JSON.stringify(height)],
    );
  }

  /** Delete all rows for a block height. Used by the reorg handler. */
  async deleteBlock(client: PoolClient, height: number): Promise<void> {
    await client.query("DELETE FROM prevblock.blocks WHERE height = $1", [
      height,
    ]);
    // Cascades handle transactions, outputs, inputs, op_returns.
  }
}
