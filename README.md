# prevblock

The Tidecoin block explorer. Lives at **prevblock.com**.

Built by prevblock, the original Tidecoin creator on bitcointalk.

## Status

| Phase | What | State |
|---|---|---|
| 0 | Discovery: RPC + protocol docs + retro | **done** — see `PHASE_0_RETRO.md`, `docs/rpc-surface.md`, `docs/tidecoin-protocol.md` |
| 1 | Backend skeleton, RPC client, classifier, cache | **shipped** (chunks A–F + retro) — see `PHASE_1_RETRO.md` |
| 2 | Indexer + `/api/v1/address/:addr` | **shipped, unverified** — see `PHASE_2_RETRO.md`. Gated on `scripts/verify-index.sh` passing on a real DB. |
| 2.1 | Hash-program consistency check, fee/subsidy from `validation.cpp`, LISTEN/NOTIFY, `/search` | **pending** the user pushing `validation.cpp` + a green verify run |
| A | Frontend conceptual model: glossary, onboarding, NotFound diagnostics, color discipline | **pending go/no-go** — can run in parallel with Phase 2.1 against fixtures |
| B | Frontend decoupling | pending |
| C | "My Tidecoin" keystone (DIRECTIVE.md §1) | gated on Phase 2 verify-green |
| D | Variable rewards (whale watch, comparison page, genesis page) | pending |

## Get going

See **[`RUNBOOK.md`](RUNBOOK.md)** for the exact command sequence to take
this repo from clone → indexed → verified → backend hitting the live
node, with pass/fail criteria at every step.

The single most satisfying acceptance moment is in §7 step 4: hitting
`/api/v1/block/0` and seeing prevblock correctly classify the genesis
output as `p2pk_falcon` while the node's own classifier reports it as
`nonstandard`.

## Repository layout

```
docs/
  rpc-surface.md          real RPC capabilities observed on the live node
  tidecoin-protocol.md    Falcon-512 sizes, witness format, script types
  sample-responses/       verbatim getblock/getrawtransaction/etc captures
  source-extracts/        verbatim Tidecoin C++ files for script/key/chainparams
packages/
  shared/                 TS types from real RPC shapes
  rpc-client/             typed JSON-RPC wrapper with Zod validation
  backend/                Fastify API + WebSocket server
  indexer/                (Phase 2) block/tx/address/utxo indexer → Postgres
  frontend/               (Phase 3) Next.js 14 explorer UI
  falcon/                 (Phase 5) Falcon-512 verification (WASM)
archive/
  v1-TideExplorer.jsx     original single-file mock (visual reference only)
  v2-template.jsx         second-pass mock (visual reference only)
PHASE_0_RETRO.md          what was wrong, what was verified, what's still guessed
```

## Operating principles (non-negotiable)

1. **No mocks.** Every number the UI displays comes from a live `tidecoind`
   via the indexer. `grep -r mock` should return hits only in test fixtures.
2. **Distrust pretraining on Tidecoin specifics.** Every protocol claim in
   `docs/` cites either a sample response or a source line. Anything that
   can't cite is marked `TODO/UNVERIFIED`.
3. **No silent stubs.** If something isn't implemented, it throws with a
   clear TODO. It never returns placeholder data that looks real.
4. **Every phase writes a retro** listing assumptions made, verified, still
   guessed, and what would be cut under time pressure.

## Development

Prereqs: Node 20+, pnpm 9+, Postgres 16, Redis 7, a synced `tidecoind`.

```bash
pnpm install
pnpm -C packages/backend dev   # Phase 1
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) (TODO, Phase 10).
