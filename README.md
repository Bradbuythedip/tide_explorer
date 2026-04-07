# prevblock

The post-quantum block explorer for [Tidecoin](https://github.com/tidecoin/tidecoin).

Named after the dev's bitcointalk handle. Lives at **prevblock.com**.

## Why it exists

Tidecoin is a Bitcoin Core 0.18.3 fork where every signature on the chain is
Falcon-512. It is the only live mainnet doing this today. Every other block
explorer — including the node's own `getrawtransaction` output — misclassifies
the genesis coinbase as `nonstandard` because upstream's `Solver()` was never
updated to understand 898-byte public keys (see
[`docs/tidecoin-protocol.md`](docs/tidecoin-protocol.md) §3.1). prevblock is
the first explorer that actually knows what it's looking at.

## Status

**Phase 0 (discovery) complete.** RPC surface captured, Falcon witness format
nailed down from real mainnet bytes and source, spec amended where the v2
design assumed things about Tidecoin that turned out to be wrong
(see [`PHASE_0_RETRO.md`](PHASE_0_RETRO.md)).

**Phase 1 (rpc-client + backend skeleton)** in progress.

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
