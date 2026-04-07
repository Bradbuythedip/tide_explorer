-- Widen inputs.prev_vout from INT to BIGINT.
--
-- Bug: coinbase inputs carry prev_vout = 0xffffffff (4294967295),
-- which overflows Postgres INT (max 2^31 - 1 = 2147483647). The
-- indexer crashed with '22003 numeric value out of range' on its
-- first attempt to insert any block with a coinbase — i.e. every
-- block — starting at block 0.
--
-- The fix is a straight ALTER; no data conversion needed because
-- the column was empty (the bug blocked all inserts of coinbase
-- transactions). We also clean up any partial state from the failed
-- attempt: the blocks table may have the genesis row with no
-- downstream transactions/outputs/inputs due to the rollback.
--
-- Cascading FKs on blocks(height) take care of removing orphaned
-- downstream rows.

BEGIN;

-- The actual fix.
ALTER TABLE prevblock.inputs
    ALTER COLUMN prev_vout TYPE BIGINT;

-- Clean up any rows inserted before the fix. Safe because every
-- pre-fix block transaction rolled back entirely (the INSERT on
-- inputs was the failing statement, so blocks rows never committed
-- in the same transaction). This is defence in depth.
TRUNCATE TABLE prevblock.blocks CASCADE;
UPDATE prevblock.chain_state
   SET v = '-1'::jsonb, updated_at = NOW()
 WHERE k = 'last_indexed_height';

COMMIT;
