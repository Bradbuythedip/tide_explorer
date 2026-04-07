# prevblock RUNBOOK

The exact sequence of commands to take this repo from "freshly cloned"
to "Phase 2 verified, ready for Phase A frontend work."

If something here is wrong, the failure mode is loud — every step has a
clear pass/fail signal. Don't proceed past a step that didn't print what
this document says it should print.

---

## 0. Prereqs (install once)

On the box that runs `tidecoind`:

```bash
# Node 20+ (the .nvmrc pins 20.11.0)
node --version           # must be >= 20.11
corepack enable          # ships with Node 20

# pnpm 9+
corepack prepare pnpm@9.12.0 --activate
pnpm --version           # must be >= 9

# Postgres 16
sudo apt install postgresql-16 postgresql-client-16
sudo systemctl enable --now postgresql

# Redis 7 (optional — backend degrades to NoopCache without it)
sudo apt install redis-server
sudo systemctl enable --now redis-server

# Standard tools used by verify-index.sh
sudo apt install jq curl python3
```

---

## 1. Clone and install

```bash
git clone https://github.com/Bradbuythedip/tide_explorer.git prevblock
cd prevblock
git checkout claude/build-tideexplorer-v2-VlfKt
pnpm install
```

Pass: `pnpm install` ends with `Done` and a packages count.
Fail: dependency-resolution errors → paste the full output, do not
proceed.

---

## 2. Database setup

```bash
sudo -u postgres createuser --pwprompt prevblock      # password: prevblock
sudo -u postgres createdb -O prevblock prevblock
psql postgres://prevblock:prevblock@127.0.0.1:5432/prevblock -c '\dn'
```

Pass: `\dn` prints `public`. (We'll add `prevblock` schema in step 4.)

---

## 3. Configure env

```bash
cp .env.example .env
$EDITOR .env
```

Set, at minimum:

```ini
TIDECOIN_RPC_URL=http://127.0.0.1:<your rpc port>/
TIDECOIN_RPC_USER=satoshi
TIDECOIN_RPC_PASSWORD=satoshi
DATABASE_URL=postgres://prevblock:prevblock@127.0.0.1:5432/prevblock
REDIS_URL=redis://127.0.0.1:6379/0   # optional
```

The RPC port is the one Phase 0 left as TODO. Find it:

```bash
ss -lntp 2>/dev/null | grep tidecoind
# or
grep -E '^rpcport' ~/.tidecoin/tidecoin.conf
# default for the 0.18.x lineage: 8332
```

Then `cat ~/.tidecoin/.cookie 2>/dev/null` is empty if you're using
explicit user/pass — that's fine.

Smoke-test the env from your shell:

```bash
curl -fsS -u "$TIDECOIN_RPC_USER:$TIDECOIN_RPC_PASSWORD" \
  -H content-type:application/json \
  -d '{"jsonrpc":"1.0","id":"smoke","method":"getblockcount","params":[]}' \
  "$TIDECOIN_RPC_URL" | jq .
```

Pass: prints `{"result": <int>, "error": null, "id": "smoke"}` with the
real tip height.
Fail: 401 → wrong creds; ECONNREFUSED → wrong port; HTML → not the RPC
endpoint. Fix before continuing.

---

## 4. Apply DB migrations

```bash
set -a; source .env; set +a
pnpm -C packages/indexer migrate
```

Pass: prints `[apply] 001_init.sql` then `migrations done`.
Verify with:

```bash
psql "$DATABASE_URL" -c "\dt prevblock.*"
```

You should see `blocks transactions outputs inputs op_returns chain_state schema_migrations`.

---

## 5. Run the indexer (catch up from genesis)

This is the long step. ~2.5M blocks at ~1 minute each → an indexer
catch-up of likely 30-90 minutes on a fast NVMe, longer on slow disks.
Run it in `screen`/`tmux` or background it.

```bash
set -a; source .env; set +a
pnpm -C packages/indexer dev
```

You should see `indexed block` lines with monotonically increasing
heights. Watch progress with:

```bash
psql "$DATABASE_URL" -c "SELECT v FROM prevblock.chain_state WHERE k='last_indexed_height';"
```

When the indexer's `last_indexed_height` catches up to
`tidecoin-cli getblockcount`, move on. It'll keep tailing.

---

## 6. Verify the indexer (THE GATE)

This is the step `DIRECTIVE.md` §10 says blocks the frontend.

```bash
set -a; source .env; set +a
./scripts/verify-index.sh
```

Required output (last line):

```
ALL CHECKS PASSED
```

If any check fails, the script prints `FAIL: <which check> <why>` to
stderr and exits non-zero.

- **A fail** = indexer reports a height the node doesn't have. Likely a
  corrupted DB; nuke it and restart from step 4.
- **B fail** = a block hash or tx_count disagrees between indexer and
  node. Bug in `sync.ts`. Paste the mismatch heights.
- **C fail** = sum of unspent value_sats != node's `total_amount * 1e8`.
  This is the killer. Means either fee/spend tracking is wrong or
  `pubkey_revealed_at_height` propagation is moving rows it shouldn't.
  Paste the diff in sats.
- **D fail** = some `p2pk_falcon` output is missing
  `pubkey_revealed_at_height`. Bug in `sync.ts::insertOutputs`.

Do not proceed past a failing verify. Send me the failing line and I
fix the bug, you re-sync, we re-verify.

---

## 7. Run the backend and hit the satisfying endpoints

```bash
set -a; source .env; set +a
pnpm -C packages/backend dev
```

In another shell:

```bash
# 1. liveness
curl -fsS http://127.0.0.1:3001/healthz
# {"ok":true}

# 2. node connectivity through the backend
curl -fsS http://127.0.0.1:3001/readyz
# {"ok":true,"tipHeight":<int matching tidecoin-cli getblockcount>}

# 3. status fan-out (the dashboard header data)
curl -fsS http://127.0.0.1:3001/api/v1/status | jq .

# 4. THE moment — the genesis block, with prevblock correctly classifying
#    the bare-Falcon-P2PK output the node itself reports as "nonstandard"
curl -fsS http://127.0.0.1:3001/api/v1/block/0 | jq '.txs[0].vout[0]'
```

Step 4's expected output includes:

```json
{
  "n": 0,
  "valueSats": "5000000000",
  "valueTdc": "50.00000000",
  "scriptType": "p2pk_falcon",     ← us
  "nodeType": "nonstandard",       ← Tidecoin's own Solver
  "pubkey": "0709..."              ← the actual 898-byte Falcon pubkey
}
```

If `scriptType` says `nonstandard`, the classifier is broken. If it says
`p2pk_falcon`, prevblock is doing what no other explorer can do.

```bash
# 5. address lookup (any T... address from a recent block works)
curl -fsS http://127.0.0.1:3001/api/v1/address/TCxVyGcc3UL9L8yRmCSqqayafAsE6G7JhX | jq .
```

Should print a `partition` object with the three Falcon buckets.

---

## 8. What I need from you to keep moving

Beyond running the above and reporting any failures, two things still
unblock real work:

### a. The `GetBlockSubsidy()` source

Push the body of `src/validation.cpp::GetBlockSubsidy` (or the whole
file) to `main` like you did with the other source extracts. I'll
move it to `docs/source-extracts/validation.cpp` and patch the
indexer fee/subsidy calculation. Until that's in, `blocks.fee_sats`
is stored as 0 — cosmetic only, doesn't break anything user-visible
yet, but blocks DIRECTIVE.md §6 comparison page numbers and the
mining-page subsidy curve.

```bash
cd ~/tidecoin
git rev-parse HEAD                             # confirm rev matches 90-source-rev.txt
cp src/validation.cpp /tmp/validation.cpp
# then add /tmp/validation.cpp to the github upload UI for
# Bradbuythedip/tide_explorer
```

### b. A go/no-go on the next chunk

Pick one and tell me:

1. **Phase A frontend (parallel track).** Spin up `packages/frontend`
   as a Next.js 14 app router scaffold. Do the no-data work
   immediately: glossary `<Term>` component, three onboarding slides
   wired to `docs/threat-model.md`, NotFound diagnostics, search
   constraints, color discipline pass. Phase C "My Tidecoin" waits
   for verify-index.sh to be green. **Recommended.** Lets visible
   progress happen while the indexer runs.
2. **Phase 2.1 backend patches.** Implement the
   hash-program-consistency check in `verify-index.sh` (largest
   unverified assumption from PHASE_2_RETRO.md), then LISTEN/NOTIFY
   from indexer to backend for cache invalidation, then `/api/v1/search`.
   Lower visible progress, higher correctness density. Pick this if
   you want to be sure the indexer is bulletproof before any UI
   touches it.
3. **Both, parallel.** I work on (1) in this thread; you push the
   `validation.cpp` source and I do (2) in a follow-up commit on top.

---

## Where each piece of the project lives

| Where | What it does |
|---|---|
| `DIRECTIVE.md` | The improvement directive (corrected from Phase 0). The product spec. |
| `README.md` | One-screen overview pointing at this runbook. |
| `RUNBOOK.md` | This file. |
| `PHASE_0_RETRO.md` | What Phase 0 discovered and what was wrong in the v2 spec. |
| `PHASE_0_AMENDMENT_RETRO.md` | What was wrong in the **directive** and how the next directive avoids it. Author-facing. |
| `PHASE_1_RETRO.md` | What Phase 1 (backend skeleton) shipped and skipped. |
| `PHASE_2_RETRO.md` | Indexer + address endpoint, with the largest unverified assumption flagged. |
| `docs/rpc-surface.md` | What Tidecoin's RPC actually exposes. |
| `docs/tidecoin-protocol.md` | Falcon-512 sizes, witness format, address types, the upstream Solver blind spot. |
| `docs/threat-model.md` | The honest three-risk model. Source for onboarding Slide 2. |
| `docs/sample-responses/` | Verbatim RPC dumps from your live node. |
| `docs/source-extracts/` | Verbatim Tidecoin C++ files. |
| `packages/shared` | TS types, amount handling, script classifier, glossary. |
| `packages/rpc-client` | Typed Tidecoin JSON-RPC wrapper. |
| `packages/backend` | Fastify API. |
| `packages/indexer` | Postgres-backed UTXO/address/pubkey-exposure indexer. |
| `packages/frontend` | (empty — Phase 3) |
| `packages/falcon` | (empty — Phase 5) |
| `sql/migrations/001_init.sql` | The one schema migration. Corrected for Falcon-only. |
| `scripts/verify-index.sh` | The Phase 2 correctness gate. |
| `archive/` | v1 and v2 mock JSXs, kept for visual reference. Do not import. |
