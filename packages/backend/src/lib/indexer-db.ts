/**
 * Backend read-only access to the indexer's Postgres database.
 *
 * The indexer owns writes. The backend only reads. We run a small
 * pool (max 4) because most routes don't touch Postgres at all; the
 * address endpoint is the primary consumer.
 *
 * If DATABASE_URL is unset at startup, `createIndexerDb()` returns
 * null and address-dependent routes respond 503 with a clear message.
 * We do NOT fake address data when the indexer isn't available.
 */

import { Pool } from "pg";
import { formatTdcAmount } from "@prevblock/shared";

export interface IndexerDb {
  getAddressSummary(address: string): Promise<AddressSummary | null>;
  close(): Promise<void>;
}

export interface AddressSummary {
  address: string;
  /** Total value of unspent outputs. */
  balanceSats: string;
  balanceTdc: string;
  /** Three-bucket Falcon partition over the unspent outputs. */
  partition: {
    hashProtectedSats: string;
    hashProtectedTdc: string;
    pubkeyExposedSats: string;
    pubkeyExposedTdc: string;
    bareP2pkSats: string;
    bareP2pkTdc: string;
  };
  utxoCount: number;
  /** True iff any output bound to this address has ever had its Falcon
   *  pubkey revealed on chain (i.e. some input witness carried it). */
  pubkeyEverRevealed: boolean;
  /** Sample of up to 100 UTXOs for display; ordered newest first. */
  utxos: UnspentOutput[];
}

export interface UnspentOutput {
  txid: string;
  vout: number;
  valueSats: string;
  valueTdc: string;
  scriptType: string;
  hashProtected: boolean;
  pubkeyRevealedAtHeight: number | null;
}

class PgIndexerDb implements IndexerDb {
  constructor(private readonly pool: Pool) {}

  async close(): Promise<void> {
    await this.pool.end();
  }

  async getAddressSummary(address: string): Promise<AddressSummary | null> {
    // One aggregate query + one detail query. Both use the partial
    // index outputs_address_unspent_idx so they should be fast even
    // on a rich address.
    const agg = await this.pool.query<{
      utxo_count: string;
      balance_sats: string;
      hash_protected_sats: string;
      pubkey_exposed_sats: string;
      bare_p2pk_sats: string;
      pubkey_ever_revealed: boolean;
    }>(
      `SELECT
         COUNT(*)::text AS utxo_count,
         COALESCE(SUM(value_sats), 0)::text AS balance_sats,
         COALESCE(SUM(CASE
           WHEN pubkey_revealed_at_height IS NULL
             AND script_type IN ('p2pkh_falcon', 'p2wpkh_falcon', 'p2wsh_falcon', 'p2sh')
           THEN value_sats ELSE 0 END), 0)::text AS hash_protected_sats,
         COALESCE(SUM(CASE
           WHEN pubkey_revealed_at_height IS NOT NULL
             AND script_type IN ('p2pkh_falcon', 'p2wpkh_falcon', 'p2wsh_falcon', 'p2sh')
           THEN value_sats ELSE 0 END), 0)::text AS pubkey_exposed_sats,
         COALESCE(SUM(CASE
           WHEN script_type = 'p2pk_falcon'
           THEN value_sats ELSE 0 END), 0)::text AS bare_p2pk_sats,
         BOOL_OR(pubkey_revealed_at_height IS NOT NULL) AS pubkey_ever_revealed
       FROM prevblock.outputs
       WHERE address = $1 AND spent_by_txid IS NULL`,
      [address],
    );

    if (agg.rowCount === 0) return null;
    const row = agg.rows[0]!;
    const utxoCount = Number(row.utxo_count);
    if (utxoCount === 0) {
      // The address is known (we've seen an output bound to it at
      // some point) but has zero UTXOs today. Still return a summary.
      const ever = await this.pool.query<{ ever: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM prevblock.outputs WHERE address = $1
         ) AS ever`,
        [address],
      );
      if (!ever.rows[0]?.ever) return null;
    }

    const detail = await this.pool.query<{
      txid: Buffer;
      vout: number;
      value_sats: string;
      script_type: string;
      pubkey_revealed_at_height: number | null;
      block_height: number;
    }>(
      `SELECT o.txid, o.vout, o.value_sats::text, o.script_type,
              o.pubkey_revealed_at_height, t.block_height
         FROM prevblock.outputs o
         JOIN prevblock.transactions t ON t.txid = o.txid
        WHERE o.address = $1 AND o.spent_by_txid IS NULL
        ORDER BY t.block_height DESC
        LIMIT 100`,
      [address],
    );

    const utxos: UnspentOutput[] = detail.rows.map((r) => ({
      txid: r.txid.toString("hex"),
      vout: r.vout,
      valueSats: r.value_sats,
      valueTdc: formatTdcAmount(BigInt(r.value_sats)),
      scriptType: r.script_type,
      hashProtected:
        r.pubkey_revealed_at_height === null &&
        r.script_type !== "p2pk_falcon",
      pubkeyRevealedAtHeight: r.pubkey_revealed_at_height,
    }));

    return {
      address,
      balanceSats: row.balance_sats,
      balanceTdc: formatTdcAmount(BigInt(row.balance_sats)),
      partition: {
        hashProtectedSats: row.hash_protected_sats,
        hashProtectedTdc: formatTdcAmount(BigInt(row.hash_protected_sats)),
        pubkeyExposedSats: row.pubkey_exposed_sats,
        pubkeyExposedTdc: formatTdcAmount(BigInt(row.pubkey_exposed_sats)),
        bareP2pkSats: row.bare_p2pk_sats,
        bareP2pkTdc: formatTdcAmount(BigInt(row.bare_p2pk_sats)),
      },
      utxoCount,
      pubkeyEverRevealed: row.pubkey_ever_revealed ?? false,
      utxos,
    };
  }
}

export function createIndexerDb(databaseUrl: string | undefined): IndexerDb | null {
  if (!databaseUrl) return null;
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  return new PgIndexerDb(pool);
}
