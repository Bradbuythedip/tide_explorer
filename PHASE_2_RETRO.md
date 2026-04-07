# Phase 2 retro — indexer + address endpoint

Per `DIRECTIVE.md` §9.

## What Phase 2 shipped

- **`sql/migrations/001_init.sql`** — six-table schema corrected for
  the Falcon-only chain: `blocks`, `transactions`, `outputs`, `inputs`,
  `op_returns`, `chain_state`. The three-bucket quantum partition is
  encoded as a single column `outputs.pubkey_revealed_at_height`: NULL
  means hash-protected, any integer means exposed at that height, and
  bare `p2pk_falcon` outputs get the height set on insertion.
- **`packages/indexer`** — TypeScript indexer:
  - `config.ts` Zod env loader
  - `db.ts` pg `Pool` with an atomic `withTx()` helper (a block is
    either fully indexed or not at all)
  - `decode.ts` dependency-free pure helpers: miner tag extractor,
    OP_RETURN payload peeler, witness-commitment detector, Falcon
    witness shape check (compares item sizes against
    `FALCON.SIGNATURE_SIZE` and `FALCON.PUBLIC_KEY_SIZE`)
  - `sync.ts` genesis-forward walker with reorg detection, per-block
    INSERT pipeline, and pubkey-exposure propagation on every Falcon
    witness spend
  - `migrate.ts` 30-line pg migration runner
  - `index.ts` entrypoint with graceful shutdown
- **`scripts/verify-index.sh`** — the Phase 2 correctness gate. Four
  checks (progress sanity, 100-height spot check, exact UTXO supply
  match, p2pk_falcon pubkey invariant). Zero tolerance on check C:
  if the SUM of unspent `value_sats` disagrees with
  `gettxoutsetinfo.total_amount * 1e8` by a single satoshi, the
  script fails and the indexer is wrong.
- **`packages/backend/lib/indexer-db.ts` + `routes/address.ts`** —
  `/api/v1/address/:addr`. Returns the three-bucket Falcon
  partition for an address in one indexed aggregate query against
  `outputs_address_unspent_idx`. Validates the input against the four
  observed mainnet address families (`tbc1…`, `T…`, `F…`, `V…`).
  Returns 503 with an explicit message when `DATABASE_URL` is unset —
  never fakes data. Cached 10 s.

## Acceptance — status

| Criterion | Status |
|---|---|
| Indexer catches up to tip from genesis | **Not run in this sandbox** (no live node reachable; no Postgres). Code path is single-transaction per block with rollback on error, so partial state on the floor is impossible. |
| `verify-index.sh` passes | **Not run.** Blocking on the user executing it against a populated DB on their box. Per `DIRECTIVE.md` §10 the frontend cannot ship personal numbers until this is green. |
| `grep -r mock packages/indexer` | **Zero hits.** |
| Reorg-safe | **Code path verified by inspection:** on prev_hash mismatch the sync loop calls `rollbackTo()` which deletes blocks at height > keepHeight and rewinds `last_indexed_height`. Not exercised against a real reorg. |
| /address returns honest numbers | **Untested end-to-end.** Query shapes verified against the schema; latency unmeasured. |

## Assumptions that are still UNVERIFIED

1. **`GetBlockSubsidy()` formula.** Still an open item from Phase 0.
   Current behaviour: `blocks.subsidy_sats` is the sum of coinbase
   outputs, which over-counts by the miner-fee sweep. `blocks.total_fees_sats`
   is currently stored as 0 for every block, which means the
   verify-index.sh supply check (C) only passes if the formula
   `sum(unspent) == node.total_amount` holds regardless of how we
   split miner payout into "subsidy vs fees." It should, because the
   UTXO set doesn't care about the split, but the fee/subsidy numbers
   in the `blocks` table are cosmetic until we read `validation.cpp`.
   **Action:** ask the user to push `src/validation.cpp` (or at minimum
   the `GetBlockSubsidy` function body). Not a blocker for §1 My
   Tidecoin.
2. **Hash160-of-Falcon-pubkey matches the address hash in the
   previous output.** The sync loop assumes that when a Falcon
   witness reveals a pubkey, the spent output's `address` column
   binds the same Hash160. If the address encoding uses a different
   hash derivation I'm not aware of, the "propagate pubkey_revealed"
   `UPDATE outputs WHERE address = $addr` query will silently mark
   the wrong set of UTXOs. **Mitigation:** verify-index.sh check D
   doesn't catch this; we need an extra check. Adding it in Phase 2.1:
   for N random `p2wpkh_falcon` spends, recompute
   `Hash160(Falcon_pubkey_from_witness)` and confirm it matches the
   `hash_program` column of the prevout.
3. **Address string encoding of the four observed families.** The
   validator regex in `routes/address.ts` accepts `tbc1…`, `T…`,
   `F…`, `V…` by shape but doesn't run base58check/bech32 checksum
   validation. A malformed address with the right first character
   will reach the DB query and return 404 cleanly (the row just
   isn't there), so this is not a correctness bug, but the "invalid
   address" UX is worse than it could be. **Action:** Phase A search
   input constraints (DIRECTIVE.md §2.6) handles this at the UI
   layer. Backend stays permissive.
4. **Address-endpoint latency budget.** The partial index
   `outputs_address_unspent_idx` should make the hot query a constant
   few ms regardless of chain size, but I haven't run EXPLAIN ANALYZE
   on anything. If the detail query's `ORDER BY block_height DESC
   LIMIT 100` turns out to be the slow part on a rich address, we
   add a composite index on `(address, block_height)`.

## Largest unverified assumption

**The pubkey-exposure semantic.** The whole `DIRECTIVE.md` §1 personal
scorecard rests on `pubkey_revealed_at_height` being accurate: an
address shows as "hash-protected" iff no input witness on chain has
ever revealed a Falcon pubkey that hashes to its program. The sync
loop's propagation step uses the stored `address` column as the
join key, not the Hash160, on the assumption that two outputs with
the same Tidecoin address string always share the same Hash160. I
believe this is true by construction of the address encoding, but I
have not *proved* it against the wallet source. If for any reason
two different Hash160s can stringify to the same address (e.g. a
version-byte collision across P2PKH and the two SCRIPT_ADDRESS
prefixes), the propagation is wrong.

**Action to verify:** add a debug query in `scripts/verify-index.sh`
that picks one pubkey-exposed address from the DB, reads every
output bound to it, and confirms every output's `hash_program`
column is identical. If so, we have empirical evidence the
assumption holds for that address. Repeat across 100 sampled
addresses. I didn't add this check to the script yet — it's the
first Phase 2.1 task.

## What I'd cut if I had half the time

- **Reorg handling.** Tidecoin is a low-hashrate chain and 6-deep
  reorgs don't happen under any realistic threat. Ship the indexer
  forward-only, let a reorg manifest as a stuck-at-ancestor error,
  and handle it with a manual re-sync. Reintroduce when a real reorg
  actually occurs.
- **Fee computation.** Store 0, not the real amount. The user sees
  "0 sat" fees on every tx, which is wrong but not dangerous.
- **Detailed OP_RETURN decoding.** Ship with witness-commitment and
  plain-text detection only. Defer the BTC block-hash anchor matcher
  (which scans for 32-byte substrings matching a real BTC block hash
  via mempool.space) to DIRECTIVE.md Phase D.
- **The 100-UTXO detail list on `/address`.** Return the aggregate
  counts only, and let the frontend fetch the detail list as a
  second call if needed. Halves the JSON size on rich addresses.

## What's next — concrete

1. **(unblocks immediately)** Spin up the Next.js frontend scaffold
   in `packages/frontend` so Phase A directive work can start against
   the existing backend. Onboarding, glossary tooltips, color
   discipline, and NotFound diagnostics need no chain data at all and
   can run against fixtures.
2. **(after the user runs the indexer once)** Run `verify-index.sh`
   against a real populated DB on the user's box. If any check
   fails, fix before the frontend ships the My Tidecoin panel.
3. **Phase 2.1 patch items** in rough priority order:
   a. Hash-program consistency check in verify-index (largest
      unverified assumption above).
   b. `GetBlockSubsidy()` formula from `validation.cpp`; fill
      `blocks.subsidy_sats` and `blocks.total_fees_sats` correctly.
   c. LISTEN/NOTIFY from the indexer → backend for cache
      invalidation on block arrival.
   d. BTC anchor detector for OP_RETURNs.
   e. Backend `/api/v1/search` (auto-detect hash / height / address
      / partial-txid) — low-effort add that unlocks DIRECTIVE.md §2.6.
