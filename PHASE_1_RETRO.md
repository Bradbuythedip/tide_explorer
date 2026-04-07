# Phase 1 retro — backend skeleton (partial)

Per `DIRECTIVE.md` §9 and v2-spec §0.4.

## What Phase 1 actually shipped

`claude/build-tideexplorer-v2-VlfKt`, commits `6ececc4` through `4ee4fc2`:

- **Chunk A** — pnpm monorepo skeleton (strict tsconfig, `.env.example`,
  `.gitignore`, six empty package dirs).
- **Chunk B** — `@prevblock/shared`: `parseTdcAmount`/`formatTdcAmount`
  (bigint sats, no float propagation), `TIDECOIN_MAINNET` constants, full
  TS interfaces for every RPC response we use, `FALCON` sizes from
  `key.h:17-19`.
- **Chunk C** — `@prevblock/rpc-client`: `TidecoinRpcClient` with undici
  pool, 3-retry backoff on transport only, Zod schemas derived field-by-
  field from `docs/sample-responses/`. Shape drift throws.
- **Chunk D** — `@prevblock/backend` skeleton: Fastify with helmet/cors/
  rate-limit, Zod env loader, `/healthz`, `/readyz`, `/api/v1/status`.
- **Chunk E** — the correctness-critical piece:
  `packages/shared/classify-script.ts` recognises **`p2pk_falcon`** (the
  upstream Solver blind spot — 902-byte `OP_PUSHDATA2 0x8203 <898B>
  OP_CHECKSIG` shape), plus the five other observed script types.
  `backend/lib/tx-view.ts` projects node-shape into corrected API shape
  with bigint sats everywhere. Routes: `/api/v1/block/:idOrHeight`,
  `/api/v1/tx/:txid`, `/api/v1/mempool/{stats,recent}`.
- **Chunk F** — Redis cache layer with explicit TTL policy
  (`forever` / `status-2s` / `mempool-stats-2s` / `fee-5s` / `txoutset-30s`
  / `address-10s`). Confirmed blocks and txs (≥6 deep) cached forever by
  hash; tip blocks bypass. Degrades to NoopCache when `REDIS_URL` is unset.

## What I cut from the original v2-spec Phase 1

Per user direction (Option 2 in the prior message): fastest path to a
working `/api/v1/address/:addr` is the priority, because the
`DIRECTIVE.md` keystone feature (My Tidecoin) is blocked on that
endpoint and everything else is optimisation. Therefore:

- **Deferred:** WebSocket server (`/ws`) with `blocks`/`mempool` channels.
  Will come after Phase 2 ships, once the indexer can emit
  block-arrival events.
- **Deferred:** `GET /api/v1/search?q=…` auto-detection. Low-effort add,
  but it can wait until we have address index support (otherwise half
  its cases don't resolve).
- **Deferred:** `GET /api/v1/fees/estimate` wrapper around
  `estimatesmartfee`. One-line addition when needed.

None of these are blockers for Phase 2 or for Phase A frontend work.

## Acceptance criteria — status

Original v2-spec Phase 1 acceptance: *"Backend serves real data from
the live node. `curl localhost:3001/api/v1/status` returns the actual
tip height. No mocks anywhere."*

| Criterion | Status |
|---|---|
| Backend serves real data | **Untested in this sandbox** (no live node reachable from here). Code path is verified by inspection: `/api/v1/status` fans out five typed RPC calls and Zod-validates each. |
| Tip height matches `tidecoin-cli getblockcount` | **Blocked on the user running the acceptance curl** against the live node on their box, after `pnpm install`. |
| `grep -r mock packages/` returns zero hits | **Passes** (confirmed by grep — the only "mock" string in the repo is inside `archive/v1-TideExplorer.jsx` and `archive/v2-template.jsx`, both explicitly marked visual-only and not imported anywhere). |
| No silent stubs | **Passes**. Every TODO in the code is accompanied by a throw or by an explicit "TODO: still-unverified" comment; nothing returns placeholder data that looks real. |
| Shape drift on a node upgrade throws | **Passes by construction** — Zod schemas in `rpc-client/src/schemas.ts` reject unknown fields at the inner-object level. |

## Assumptions I made that are still UNVERIFIED

1. **`txindex=1` is actually set on the running node.** The active conf
   file in `docs/sample-responses/00-conf.txt` is a "faster sync"
   overlay and doesn't set it explicitly. The operator's earlier
   `getrawtransaction <txid>` calls did succeed without a blockhash, so
   the option is set *somewhere*, but I haven't confirmed. If it turns
   out not to be set, `/api/v1/tx/:txid` will fail for any txid not in
   a block the caller already knows about, and callers will have to
   pass `?blockhash=...` every time.
2. **The default RPC port is 8332.** Still unknown. I've hardcoded it
   in `.env.example` and left a TODO in `docs/rpc-surface.md`. If the
   real port differs, the `.env` override will catch it at deploy
   time, but I haven't executed the verify.
3. **`mempoolentry.fee` is in TDC decimal** (not satoshis). Confirmed
   for Bitcoin Core 0.18.x; not directly sampled for Tidecoin. The
   `mempool/recent` route parses it as TDC via `parseTdcAmount`. If it
   turns out to be sats, values will be off by 1e8 and obvious.
4. **Confirmed blocks six-deep really are reorg-safe on Tidecoin.**
   The `confirmations >= 6` cache guard in `/block` and `/tx` is the
   standard Bitcoin assumption. On a 1-minute-block chain with
   difficulty ~0.17, a 6-deep reorg is ~6 minutes of chain time, and
   the attacker needs >50% of ~17 MH/s — trivial from a nation-state
   perspective, infeasible from any current actor. For now this is
   safe. Revisit when Tidecoin hashrate or threat model changes.

## Largest unverified assumption right now

**Whether the current address endpoint plan (Phase 2i: read from the
indexer Postgres) can serve the My Tidecoin latency budget.** The
indexer has to build its own address index because Tidecoin's node
doesn't expose `getaddress*` RPCs. For ~900K UTXOs today that's
trivial, but the Phase C UX requires that pasting an address returns
results fast enough to feel like a lookup, not a query. I have not
measured anything yet. If it turns out to take >200 ms on realistic
hardware, Phase C needs a materialised balance view or an in-memory
index on top of Postgres.

## What I'd cut if I had half the time

- **NoopCache fallback.** Keep just RedisCache and require REDIS_URL.
  Simpler code path, one less branch to reason about. I kept the
  NoopCache because local dev is easier without Redis running, but
  that's a convenience, not a correctness need.
- **The bignumber-sats-and-decimal-string dual rendering on every
  endpoint.** I'd render only the string, force callers to parse it
  back into bigint if they need arithmetic, and save a handful of
  allocations per response. Not a meaningful win and loses the
  "inspect with curl" ergonomics, but it's the most obvious cut.
- **Retry logic in the RPC client.** 3 attempts + exponential backoff
  is what the v2 spec called for; one attempt with a clear error
  message is probably fine given the backend runs on the same host
  as the node and all real failures are permanent. Cut to save code.

## Concrete unblocks needed from the user

- Run `pnpm install && pnpm -C packages/backend dev` against the live
  node. Verify `/api/v1/status` tip height matches `tidecoin-cli
  getblockcount`. Report any Zod validation failures (those are the
  early-warning system for schema drift between my samples and
  whatever the node is currently returning).
- Optional: run the `/api/v1/block/0` round-trip and confirm the
  genesis's only output is labelled `scriptType: "p2pk_falcon"` in
  the JSON. This is the single most satisfying moment of the project
  — the block explorer correctly identifying a Falcon output the node
  itself calls `nonstandard`.
