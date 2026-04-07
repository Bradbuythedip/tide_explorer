-- prevblock Phase 2 indexer schema
--
-- Corrections from the v2 spec baseline:
--   * All amounts are NUMERIC(20,0) bigint-sats, NEVER DOUBLE PRECISION TDC.
--   * No has_ecdsa_input column (there is no ECDSA on this chain).
--   * The quantum partition is three-bucket within Falcon, not two-way
--     ECDSA/Falcon. See DIRECTIVE.md §0 amendment #3 and
--     docs/tidecoin-protocol.md §4.
--   * outputs.script_type ENUM matches packages/shared/src/script-types.ts
--     exactly (p2pk_falcon is recognised; Tidecoin's own Solver() cannot
--     see this form).
--
-- Design notes:
--   * UTXO tracking is owned by this schema. We do NOT rely on
--     tidecoind's missing getaddress* RPCs.
--   * A "pubkey_revealed_at_height" column on outputs is the core data
--     point for the three-bucket partition. NULL = never revealed =
--     hash-protected. Non-NULL = exposed at that height (or at the
--     block the output itself was created in, for bare P2PK-Falcon).
--   * We index by address explicitly so /api/v1/address/:addr is a
--     single indexed lookup. This is the latency-critical path for
--     DIRECTIVE.md §1 My Tidecoin.

BEGIN;

CREATE SCHEMA IF NOT EXISTS prevblock;
SET search_path TO prevblock, public;

-- ---- block ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS blocks (
    height           BIGINT PRIMARY KEY,
    hash             BYTEA NOT NULL UNIQUE,
    prev_hash        BYTEA,
    merkle_root      BYTEA NOT NULL,
    block_time       TIMESTAMPTZ NOT NULL,
    median_time      TIMESTAMPTZ NOT NULL,
    version          INT NOT NULL,
    bits             BYTEA NOT NULL,
    nonce            BIGINT NOT NULL,
    difficulty       DOUBLE PRECISION NOT NULL,
    chainwork        BYTEA NOT NULL,
    size_bytes       INT NOT NULL,
    stripped_size    INT NOT NULL,
    weight           INT NOT NULL,
    tx_count         INT NOT NULL,
    total_fees_sats  NUMERIC(20,0) NOT NULL,
    -- From source code (TBD: docs/tidecoin-protocol.md #7 item 1 is
    -- still open; this field is populated but its interpretation is
    -- a best-effort estimate until GetBlockSubsidy() is captured).
    subsidy_sats     NUMERIC(20,0) NOT NULL,
    miner_tag        TEXT,
    -- Count of txs in this block that consumed at least one input
    -- whose witness reveals a Falcon pubkey (pubkey-exposing event).
    pubkey_exposing_tx_count INT NOT NULL DEFAULT 0,
    -- Count of txs in this block with at least one bare P2PK-Falcon output.
    p2pk_falcon_out_tx_count INT NOT NULL DEFAULT 0,
    CONSTRAINT blocks_subsidy_nonneg CHECK (subsidy_sats >= 0),
    CONSTRAINT blocks_fees_nonneg    CHECK (total_fees_sats >= 0)
);

CREATE INDEX IF NOT EXISTS blocks_time_idx ON blocks (block_time);

-- ---- transactions ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS transactions (
    txid             BYTEA PRIMARY KEY,
    wtxid            BYTEA NOT NULL,
    block_height     BIGINT NOT NULL REFERENCES blocks(height) ON DELETE CASCADE,
    block_index      INT NOT NULL,
    size             INT NOT NULL,
    vsize            INT NOT NULL,
    weight           INT NOT NULL,
    locktime         BIGINT NOT NULL,
    fee_sats         NUMERIC(20,0) NOT NULL DEFAULT 0,
    is_coinbase      BOOLEAN NOT NULL,
    is_rbf           BOOLEAN NOT NULL,
    -- True iff any input witness on this tx was a
    -- [falcon_sig(690), falcon_pubkey(898)] stack.
    has_falcon_p2wpkh_input BOOLEAN NOT NULL,
    -- True iff any output on this tx is bare P2PK-Falcon.
    has_p2pk_falcon_output  BOOLEAN NOT NULL,
    CONSTRAINT tx_fee_nonneg CHECK (fee_sats >= 0)
);

CREATE INDEX IF NOT EXISTS transactions_block_idx ON transactions (block_height, block_index);

-- ---- script_type enum ------------------------------------------------------
-- Must stay in lockstep with packages/shared/src/script-types.ts.

DO $$ BEGIN
    CREATE TYPE script_type AS ENUM (
        'p2pk_falcon',
        'p2pkh_falcon',
        'p2sh',
        'p2wpkh_falcon',
        'p2wsh_falcon',
        'op_return',
        'witness_unknown',
        'nonstandard'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- outputs (UTXO-aware) ------------------------------------------------

CREATE TABLE IF NOT EXISTS outputs (
    txid                    BYTEA NOT NULL REFERENCES transactions(txid) ON DELETE CASCADE,
    vout                    INT NOT NULL,
    value_sats              NUMERIC(20,0) NOT NULL,
    script_type             script_type NOT NULL,
    script_pubkey           BYTEA NOT NULL,
    -- NULL when the output's script type doesn't bind to an address
    -- (bare P2PK-Falcon, OP_RETURN, witness_unknown, nonstandard).
    address                 TEXT,
    -- For hash-programmed outputs (P2PKH-Falcon, P2WPKH-Falcon, P2SH):
    -- the 20-byte Hash160 that guards the pubkey/script. Kept for
    -- future audits.
    hash_program            BYTEA,
    -- For p2pk_falcon outputs: the raw 898-byte Falcon pubkey.
    falcon_pubkey           BYTEA,
    -- Spent tracking ----------------------------------------
    spent_by_txid           BYTEA REFERENCES transactions(txid) ON DELETE SET NULL,
    spent_by_vin            INT,
    spent_at_height         BIGINT REFERENCES blocks(height) ON DELETE SET NULL,
    -- Pubkey exposure tracking ------------------------------
    -- For bare P2PK-Falcon outputs this equals the block the output
    -- was created in: the pubkey was on chain from day one.
    -- For hash-programmed outputs, this is populated when the
    -- address's pubkey is first revealed in any spending input's
    -- witness. Prior to that event it is NULL (= hash-protected).
    pubkey_revealed_at_height BIGINT REFERENCES blocks(height) ON DELETE SET NULL,
    -- Constraints ------------------------------------------
    PRIMARY KEY (txid, vout),
    CONSTRAINT outputs_value_nonneg CHECK (value_sats >= 0)
);

-- Hot paths:
--   /api/v1/address/:addr -> filter on address, usually unspent
CREATE INDEX IF NOT EXISTS outputs_address_idx
    ON outputs (address)
    WHERE address IS NOT NULL;

CREATE INDEX IF NOT EXISTS outputs_address_unspent_idx
    ON outputs (address)
    WHERE address IS NOT NULL AND spent_by_txid IS NULL;

-- Spend tracking reverse lookup
CREATE INDEX IF NOT EXISTS outputs_spent_by_idx
    ON outputs (spent_by_txid)
    WHERE spent_by_txid IS NOT NULL;

-- For the Quantum Dashboard (§4 of the directive) we need fast access
-- to the three-bucket partition over the full UTXO set. A partial
-- index on UNSPENT outputs is much smaller than a full scan.
CREATE INDEX IF NOT EXISTS outputs_unspent_partition_idx
    ON outputs (pubkey_revealed_at_height, script_type)
    WHERE spent_by_txid IS NULL;

-- ---- inputs --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inputs (
    txid            BYTEA NOT NULL REFERENCES transactions(txid) ON DELETE CASCADE,
    vin             INT NOT NULL,
    prev_txid       BYTEA NOT NULL,
    prev_vout       INT NOT NULL,
    sequence        BIGINT NOT NULL,
    script_sig      BYTEA,
    -- Witness stack serialized as a length-prefixed blob of items:
    -- [varint count][for each item: varint len + bytes]
    witness         BYTEA,
    -- Cached Falcon-shape detection. True iff the witness has
    -- exactly two items and (items[0].len, items[1].len) == (690, 898).
    witness_is_falcon_p2wpkh BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (txid, vin)
);

CREATE INDEX IF NOT EXISTS inputs_prev_idx ON inputs (prev_txid, prev_vout);

-- ---- op_returns (attestation payload store) --------------------------

CREATE TABLE IF NOT EXISTS op_returns (
    txid            BYTEA NOT NULL,
    vout            INT NOT NULL,
    data            BYTEA NOT NULL,
    -- NULL until a decoder matches; one of:
    --   'btc-anchor' | 'plain-text' | 'witness-commit' | ...
    detected_protocol TEXT,
    decoded_payload   JSONB,
    PRIMARY KEY (txid, vout),
    FOREIGN KEY (txid, vout) REFERENCES outputs(txid, vout) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS op_returns_protocol_idx
    ON op_returns (detected_protocol)
    WHERE detected_protocol IS NOT NULL;

-- ---- chain state (indexer progress + aggregates) ------------------

CREATE TABLE IF NOT EXISTS chain_state (
    k   TEXT PRIMARY KEY,
    v   JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the progress marker row. Updated atomically after each block.
INSERT INTO chain_state (k, v)
VALUES ('last_indexed_height', '-1'::jsonb)
ON CONFLICT (k) DO NOTHING;

COMMIT;
