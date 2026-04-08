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
  getRichlist(minSats: bigint, limit: number): Promise<RichlistResult>;
  getQuantumSupply(): Promise<QuantumSupply>;
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

export interface RichlistEntry {
  rank: number;
  address: string;
  balanceSats: string;
  balanceTdc: string;
  utxoCount: number;
  /**
   * Per-entry three-bucket Falcon partition. Lets the UI render
   * a stacked-bar next to each row showing how exposed this whale
   * actually is.
   */
  hashProtectedSats: string;
  pubkeyExposedSats: string;
  bareP2pkSats: string;
}

export interface RichlistResult {
  /** Minimum balance threshold the query was run with, in sats. */
  minSats: string;
  /** Total number of addresses meeting the threshold. May be larger
   *  than entries.length if `limit` truncated. */
  totalAddresses: number;
  /** Sum of all balances meeting the threshold. */
  totalSats: string;
  /** Sum of UNFILTERED supply in the indexer (all unspent outputs
   *  the indexer has seen so far, regardless of address). This is
   *  the INDEXER'S supply, not the chain's real supply — compare
   *  against asOfHeight below to see how much of the chain is
   *  represented. */
  indexedSupplySats: string;
  /** The indexer's last_indexed_height when this snapshot was taken.
   *  Lets the UI display freshness and compute a "richlist is
   *  populating" banner against the real node tip. */
  asOfHeight: number;
  entries: RichlistEntry[];
}

/**
 * Three-bucket Falcon partition over the entire UTXO set.
 *
 * Bucket definitions (DIRECTIVE.md §0 amendment #3,
 * docs/tidecoin-protocol.md §4):
 *
 *   hashProtected
 *     pubkey_revealed_at_height IS NULL AND
 *     script_type IN (p2pkh_falcon, p2wpkh_falcon, p2wsh_falcon, p2sh)
 *
 *   pubkeyExposed
 *     pubkey_revealed_at_height IS NOT NULL AND
 *     script_type IN (p2pkh_falcon, p2wpkh_falcon, p2wsh_falcon, p2sh)
 *
 *   bareP2pk
 *     script_type = p2pk_falcon (the genesis form; the upstream
 *     Solver blind spot — see docs/tidecoin-protocol.md §3.1)
 *
 *   unclassified
 *     anything else (op_return, witness_unknown, nonstandard).
 *     Always small; tracked separately so the buckets sum to the
 *     total UTXO supply exactly.
 */
export interface QuantumSupply {
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
  /** Indexer height at the moment the aggregate was computed. */
  asOfHeight: number;
  /** True iff the indexer has caught up to within 6 blocks of tip,
   *  meaning the numbers are real. False during catch-up; the UI
   *  shows a "still indexing" banner instead of fake fractions. */
  isAtTip: boolean;
  /** Distance from tip at the time of the query, in blocks. */
  blocksBehindTip: number;
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

  async getRichlist(minSats: bigint, limit: number): Promise<RichlistResult> {
    // Two queries: a header (count + total + supply) and the page.
    // The page query group-bys address with the same per-address
    // partition we already produce for /address/:addr, so the UI
    // can stack-bar each row without a second round-trip.
    const header = await this.pool.query<{
      total_addresses: string;
      total_sats: string;
      indexed_supply_sats: string;
      as_of_height: string | null;
    }>(
      `WITH agg AS (
         SELECT address, SUM(value_sats) AS bal
           FROM prevblock.outputs
          WHERE address IS NOT NULL AND spent_by_txid IS NULL
          GROUP BY address
       )
       SELECT
         (SELECT COUNT(*)::text FROM agg WHERE bal >= $1::numeric) AS total_addresses,
         (SELECT COALESCE(SUM(bal), 0)::text FROM agg WHERE bal >= $1::numeric) AS total_sats,
         (SELECT COALESCE(SUM(value_sats), 0)::text
            FROM prevblock.outputs
           WHERE spent_by_txid IS NULL) AS indexed_supply_sats,
         (SELECT v::text FROM prevblock.chain_state
           WHERE k = 'last_indexed_height') AS as_of_height`,
      [minSats.toString()],
    );

    const headerRow = header.rows[0]!;

    // CRITICAL: ORDER BY must use the raw numeric SUM, not the text-cast
    // alias. Postgres ORDER BY of a TEXT column sorts lexicographically,
    // so '999...' comes after '1000...' alphabetically and the richlist
    // looks shuffled. We compute SUM(value_sats) twice (once for ORDER
    // BY, once cast for output); the planner deduplicates this so the
    // double mention is free.
    const pageRows = await this.pool.query<{
      address: string;
      balance_sats: string;
      utxo_count: string;
      hash_protected_sats: string;
      pubkey_exposed_sats: string;
      bare_p2pk_sats: string;
    }>(
      `SELECT
         address,
         SUM(value_sats)::text AS balance_sats,
         COUNT(*)::text AS utxo_count,
         COALESCE(SUM(CASE
           WHEN pubkey_revealed_at_height IS NULL
             AND script_type IN ('p2pkh_falcon','p2wpkh_falcon','p2wsh_falcon','p2sh')
           THEN value_sats ELSE 0 END), 0)::text AS hash_protected_sats,
         COALESCE(SUM(CASE
           WHEN pubkey_revealed_at_height IS NOT NULL
             AND script_type IN ('p2pkh_falcon','p2wpkh_falcon','p2wsh_falcon','p2sh')
           THEN value_sats ELSE 0 END), 0)::text AS pubkey_exposed_sats,
         COALESCE(SUM(CASE
           WHEN script_type = 'p2pk_falcon'
           THEN value_sats ELSE 0 END), 0)::text AS bare_p2pk_sats
       FROM prevblock.outputs
       WHERE address IS NOT NULL AND spent_by_txid IS NULL
       GROUP BY address
       HAVING SUM(value_sats) >= $1::numeric
       ORDER BY SUM(value_sats) DESC
       LIMIT $2`,
      [minSats.toString(), limit],
    );

    const entries: RichlistEntry[] = pageRows.rows.map((r, i) => ({
      rank: i + 1,
      address: r.address,
      balanceSats: r.balance_sats,
      balanceTdc: formatTdcAmount(BigInt(r.balance_sats)),
      utxoCount: Number(r.utxo_count),
      hashProtectedSats: r.hash_protected_sats,
      pubkeyExposedSats: r.pubkey_exposed_sats,
      bareP2pkSats: r.bare_p2pk_sats,
    }));

    return {
      minSats: minSats.toString(),
      totalAddresses: Number(headerRow.total_addresses),
      totalSats: headerRow.total_sats,
      indexedSupplySats: headerRow.indexed_supply_sats,
      asOfHeight: Number.parseInt(headerRow.as_of_height ?? "-1", 10),
      entries,
    };
  }

  async getQuantumSupply(): Promise<QuantumSupply> {
    // Single aggregate query — uses the partial index
    // outputs_unspent_partition_idx for fast scan of just the
    // unspent UTXOs.
    const row = await this.pool.query<{
      hash_protected: string;
      pubkey_exposed: string;
      bare_p2pk: string;
      unclassified: string;
      total: string;
      as_of_height: string;
    }>(
      `SELECT
         COALESCE(SUM(CASE
           WHEN pubkey_revealed_at_height IS NULL
             AND script_type IN ('p2pkh_falcon','p2wpkh_falcon','p2wsh_falcon','p2sh')
           THEN value_sats ELSE 0 END), 0)::text AS hash_protected,
         COALESCE(SUM(CASE
           WHEN pubkey_revealed_at_height IS NOT NULL
             AND script_type IN ('p2pkh_falcon','p2wpkh_falcon','p2wsh_falcon','p2sh')
           THEN value_sats ELSE 0 END), 0)::text AS pubkey_exposed,
         COALESCE(SUM(CASE
           WHEN script_type = 'p2pk_falcon'
           THEN value_sats ELSE 0 END), 0)::text AS bare_p2pk,
         COALESCE(SUM(CASE
           WHEN script_type IN ('op_return','witness_unknown','nonstandard')
           THEN value_sats ELSE 0 END), 0)::text AS unclassified,
         COALESCE(SUM(value_sats), 0)::text AS total,
         (SELECT v::text FROM prevblock.chain_state
           WHERE k='last_indexed_height') AS as_of_height
       FROM prevblock.outputs
       WHERE spent_by_txid IS NULL`,
    );

    const r = row.rows[0]!;
    const asOfHeight = Number.parseInt(r.as_of_height ?? "-1", 10);
    return {
      totalSats: r.total,
      totalTdc: formatTdcAmount(BigInt(r.total)),
      hashProtectedSats: r.hash_protected,
      hashProtectedTdc: formatTdcAmount(BigInt(r.hash_protected)),
      pubkeyExposedSats: r.pubkey_exposed,
      pubkeyExposedTdc: formatTdcAmount(BigInt(r.pubkey_exposed)),
      bareP2pkSats: r.bare_p2pk,
      bareP2pkTdc: formatTdcAmount(BigInt(r.bare_p2pk)),
      unclassifiedSats: r.unclassified,
      unclassifiedTdc: formatTdcAmount(BigInt(r.unclassified)),
      asOfHeight,
      // The route layer fills these in by comparing against the
      // node tip; we don't want indexer-db to know about the RPC
      // client. Default to false here.
      isAtTip: false,
      blocksBehindTip: -1,
    };
  }
}

export function createIndexerDb(databaseUrl: string | undefined): IndexerDb | null {
  if (!databaseUrl) return null;
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  return new PgIndexerDb(pool);
}
