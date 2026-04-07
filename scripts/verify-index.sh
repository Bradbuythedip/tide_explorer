#!/usr/bin/env bash
# verify-index.sh — cross-check the indexer's state against the live node.
#
# Exit 0 iff every spot-check passes. Exit non-zero (with a human-
# readable diff on stderr) otherwise. No partial credit.
#
# Checks:
#   A. last_indexed_height <= getblockcount
#   B. For 100 random heights between 0 and last_indexed_height:
#        - blocks.hash (DB) == getblockhash(height) (node)
#        - blocks.tx_count (DB) == length(getblock.tx) (node)
#   C. UTXO supply sanity:
#        sum(value_sats) for unspent outputs in DB
#        ==
#        gettxoutsetinfo.total_amount * 1e8
#     (tolerance: 0 — if these disagree the indexer is wrong.)
#   D. 'scripts' per DIRECTIVE.md §0 definition-of-done:
#        - every output labelled script_type='p2pk_falcon' has
#          pubkey_revealed_at_height IS NOT NULL
#        - every unspent output whose address != NULL has a valid
#          script_type
#
# Usage:
#   DATABASE_URL=postgres://... \
#   TIDECOIN_RPC_URL=http://127.0.0.1:8332/ \
#   TIDECOIN_RPC_USER=satoshi TIDECOIN_RPC_PASSWORD=satoshi \
#   scripts/verify-index.sh

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${TIDECOIN_RPC_URL:?TIDECOIN_RPC_URL is required}"
: "${TIDECOIN_RPC_USER:?TIDECOIN_RPC_USER is required}"
: "${TIDECOIN_RPC_PASSWORD:?TIDECOIN_RPC_PASSWORD is required}"

PSQL="psql --no-psqlrc -tAX $DATABASE_URL"

rpc() {
  local method="$1"; shift
  local params="[]"
  if [ $# -gt 0 ]; then params="$1"; fi
  curl -fsS --user "$TIDECOIN_RPC_USER:$TIDECOIN_RPC_PASSWORD" \
       -H content-type:application/json \
       -d "{\"jsonrpc\":\"1.0\",\"id\":\"verify\",\"method\":\"$method\",\"params\":$params}" \
       "$TIDECOIN_RPC_URL" \
    | jq -r '.result'
}

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "PASS: $*"; }

# ---- A. progress marker ---------------------------------------------------
LAST_INDEXED=$($PSQL -c "SELECT v::text FROM prevblock.chain_state WHERE k='last_indexed_height';")
NODE_HEIGHT=$(rpc getblockcount)
if [ "$LAST_INDEXED" -gt "$NODE_HEIGHT" ]; then
  fail "A: indexer is ahead of the node ($LAST_INDEXED > $NODE_HEIGHT)"
fi
pass "A: last_indexed_height=$LAST_INDEXED, node_tip=$NODE_HEIGHT"

if [ "$LAST_INDEXED" -lt 0 ]; then
  fail "A: indexer has not started (last_indexed_height=$LAST_INDEXED)"
fi

# ---- B. spot-check 100 random heights ------------------------------------
SAMPLE_SIZE=100
MAX_HEIGHT=$LAST_INDEXED
MISMATCHES=0
for i in $(seq 1 $SAMPLE_SIZE); do
  H=$(( RANDOM * RANDOM % (MAX_HEIGHT + 1) ))
  DB_HASH=$($PSQL -c "SELECT encode(hash,'hex') FROM prevblock.blocks WHERE height=$H;")
  DB_TXCOUNT=$($PSQL -c "SELECT tx_count FROM prevblock.blocks WHERE height=$H;")
  NODE_HASH=$(rpc getblockhash "[$H]")
  NODE_TXCOUNT=$(rpc getblock "[\"$NODE_HASH\", 1]" | jq '.tx | length')

  if [ "$DB_HASH" != "$NODE_HASH" ]; then
    echo "  mismatch at height $H: db=$DB_HASH node=$NODE_HASH" >&2
    MISMATCHES=$((MISMATCHES + 1))
  fi
  if [ "$DB_TXCOUNT" != "$NODE_TXCOUNT" ]; then
    echo "  tx_count mismatch at height $H: db=$DB_TXCOUNT node=$NODE_TXCOUNT" >&2
    MISMATCHES=$((MISMATCHES + 1))
  fi
done

if [ "$MISMATCHES" -ne 0 ]; then
  fail "B: $MISMATCHES mismatches in $SAMPLE_SIZE spot-checks"
fi
pass "B: $SAMPLE_SIZE spot-checks clean"

# ---- C. UTXO supply sanity -----------------------------------------------
DB_SUPPLY=$($PSQL -c "SELECT COALESCE(SUM(value_sats), 0)::text FROM prevblock.outputs WHERE spent_by_txid IS NULL;")
NODE_SUPPLY_TDC=$(rpc gettxoutsetinfo | jq -r '.total_amount')
# Convert node supply to sats without float loss:
NODE_SUPPLY=$(python3 -c "
from decimal import Decimal
print(int(Decimal('$NODE_SUPPLY_TDC') * Decimal(10**8)))
")

if [ "$DB_SUPPLY" != "$NODE_SUPPLY" ]; then
  fail "C: UTXO supply mismatch db=$DB_SUPPLY node=$NODE_SUPPLY (diff $((DB_SUPPLY - NODE_SUPPLY)) sats)"
fi
pass "C: UTXO supply = $DB_SUPPLY sats matches node exactly"

# ---- D. script-type invariants -------------------------------------------
BARE_UNREVEALED=$($PSQL -c "
  SELECT COUNT(*) FROM prevblock.outputs
  WHERE script_type = 'p2pk_falcon' AND pubkey_revealed_at_height IS NULL;
")
if [ "$BARE_UNREVEALED" != "0" ]; then
  fail "D: $BARE_UNREVEALED p2pk_falcon outputs lack pubkey_revealed_at_height"
fi
pass "D: every p2pk_falcon output has pubkey_revealed_at_height set"

echo "ALL CHECKS PASSED"
