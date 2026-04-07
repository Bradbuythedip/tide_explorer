# Tidecoin RPC surface (live-node ground truth)

Captured from `tidecoin-cli help` against a synced mainnet node, version
`/TidecoinCore:0.18.3/` (protocol 70015), tip 2,503,300, on 2026-04-07.
Full verbatim help is in [`sample-responses/80-help-detail.txt`](sample-responses/80-help-detail.txt).
This page documents only what differs from Bitcoin Core 0.18.x and what the
backend/indexer actually depends on.

## Base lineage

- Forked from **Bitcoin Core 0.18.3**. `subversion = "/TidecoinCore:0.18.3/"`.
- Pre-PSBTv2, pre-`getindexinfo`, pre-`scanblocks`, pre-`getdeploymentinfo`.
- `sendrawtransaction` still takes the old boolean `allowhighfees` instead of
  `maxfeerate`. `testmempoolaccept` likewise.
- `generate` (deprecated upstream) is still present.
- BIP9 deployments dict still uses `bip9_softforks`, not `softforks`/`status`.

## Methods we rely on

| Method | Purpose | Notes |
|---|---|---|
| `getblockchaininfo` | tip height, headers, verification progress, sync flag | no `time` field; use tip block for that |
| `getblockcount` / `getbestblockhash` | cheap polling | use this for the indexer poll loop (no ZMQ — see below) |
| `getblockhash <h>` | height → hash | |
| `getblock <hash> 2` | full block + decoded txs | verbosity 3 (prevout join) is **not** supported on this version |
| `getblockheader <hash>` | header only | |
| `getblockstats` | per-block aggregates | useful for fee/size charts |
| `getrawtransaction <txid> true [blockhash]` | decoded tx | requires `txindex=1` for arbitrary txids; the running node has it |
| `getrawtransaction <txid> false` | raw hex | indexer needs hex to parse the witness ourselves (see protocol doc) |
| `decoderawtransaction <hex> [iswitness]` | round-trip decode | |
| `decodescript <hex>` | classify scriptPubKey | does NOT recognise the bare-Falcon `<898-byte push> OP_CHECKSIG` form — returns `nonstandard`. Indexer must classify itself. |
| `gettxout <txid> n` | live UTXO query | |
| `gettxoutsetinfo` | UTXO set total | slow; cache aggressively |
| `getrawmempool true` | mempool snapshot | poll-only; no ZMQ |
| `getmempoolentry <txid>` / `getmempoolinfo` | per-tx + summary | |
| `estimatesmartfee` | fee estimation | |
| `getmininginfo`, `getnetworkhashps` | hashrate page | |
| `getnetworkinfo`, `getpeerinfo`, `getconnectioncount` | network page | |
| `getzmqnotifications` | enumerate ZMQ topics | **returns `[]` on this node — no ZMQ available, indexer must poll** |
| `validateaddress <addr>` | address sanity | works for the three observed types (see protocol doc) |
| `getchaintips` | reorg / orphan visibility | |

## Methods we cannot rely on

These were either expected by Bitcoin-Core-derived assumptions or by the
v2 spec, and **do not exist** on this build:

| Missing method | Why we expected it | Workaround |
|---|---|---|
| `getindexinfo` | added in BTC 0.21 | none — assume `txindex` from conf |
| `getaddressbalance`, `getaddresstxids`, `getaddressutxos`, `getaddressdeltas`, `getaddressmempool`, `getspentinfo` | the running conf had `addressindex=1`, but the **`getaddress*` RPCs simply do not exist in this binary** (all return `help: unknown command`). The flag is silently ignored. | indexer must build its own address index from scratch |
| `scanblocks`, `getdeploymentinfo` | added in BTC 22+/24+ | not needed |
| ZMQ topics | `getzmqnotifications == []` | poll `getbestblockhash` every 1–5 s; mempool tracker polls `getrawmempool true` every 2 s |

See the verbatim raw probe in
[`sample-responses/40-addr-rpc-probe.txt`](sample-responses/40-addr-rpc-probe.txt).

## Connection details (as observed)

- Conf path on the host that the operator actually uses: **`~/.tidecoin/tidecoin.conf`**
  (NOT `/mnt/fast_nvme/tidecoin_data/tidecoin.conf` as the v2 spec assumed —
  the latter is the data dir, not the conf dir).
- The conf in use ([`sample-responses/00-conf.txt`](sample-responses/00-conf.txt))
  is a "faster sync" overlay; `txindex=1` is set globally elsewhere (the running
  node responds to `getrawtransaction` for arbitrary txids, confirming it).
- `rpcuser=satoshi`, `rpcpassword=satoshi`, `rpcbind=127.0.0.1`.
- **Default RPC port for Tidecoin mainnet**: not yet captured — `getnetworkinfo`
  reports a P2P port `8755` for the local listener but not the RPC port. The
  conf doesn't pin one, so it's the chainparams default. **TODO** capture from
  `chainparams.cpp::nDefaultPort`-equivalent or by running `tidecoin-cli` with
  `-rpcport=` removed and watching `ss -lntp`.
