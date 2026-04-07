# Phase 0 retro — discovery against the live node

Per spec §0.4: every assumption I made, what I verified, what's still a
guess, and what I'd cut.

## Assumptions from the v2 spec that turned out to be wrong

| # | v2 spec assumption | Reality | Source |
|---|---|---|---|
| 1 | Conf path is `/mnt/fast_nvme/tidecoin_data/tidecoin.conf` | The data dir is at that path, but the **conf** the operator actually uses is `~/.tidecoin/tidecoin.conf`. The data-dir version may also exist but the running daemon reads `~/.tidecoin/`. | error message in the operator's first attempt: `Configuration file: (/home/brad/.tidecoin/tidecoin.conf)` |
| 2 | Default RPC port is "discover from the conf, do not assume 8332" | Conf doesn't pin a port. We still don't know it. **Still unverified.** | `00-conf.txt` |
| 3 | Address prefix is `tdc1q…` | Bech32 HRP is **`tbc`**, so native segwit would be `tbc1q…`. Mainnet base58 prefixes are 33/65/70/125 → `F…`/`T…`/`V…`/`7…`. Every observed address on chain is `T…` (P2SH under the secondary prefix `SCRIPT_ADDRESS2 = 65`). | `chainparams.cpp:128-135`, observed addresses in `31-busy-block.json` |
| 4 | Block time ~8 minutes | **60 seconds.** `nPowTargetSpacing = 60`. | `chainparams.cpp:74` |
| 5 | Subsidy 50 TDC, BTC-style halving every 4 years | Halving interval is **262,800 blocks ≈ 6 months**. Genesis subsidy is 50 TDC, but at the tip the coinbase pays only 0.625 TDC, which doesn't match `50 / 2^n` for any integer n. The actual `GetBlockSubsidy()` formula is **not yet captured** and may be a custom curve, not a clean halving. | `chainparams.cpp:66`, `21-tip-block.json` vs `11-genesis-block.json` |
| 6 | Tidecoin has both ECDSA and Falcon outputs and the explorer's job is to bucket coins between them | **Wrong, and this is the biggest finding of Phase 0.** `key.h` defines `PRIVATE_KEY_SIZE`, `PUBLIC_KEY_SIZE`, and `SIGNATURE_SIZE` exclusively in terms of `PQCLEAN_FALCON512_*` constants — there is no secp256k1 codepath retained anywhere. **Every key on this chain is Falcon-512.** The Quantum Dashboard's three-bucket model collapses; the real partition is hash-protected vs pubkey-exposed within Falcon. The Shor framing is irrelevant on Tidecoin and must be removed from the educational copy. | `key.h:17-19`, `pubkey.h:36-64` |
| 7 | "addressindex=1 in the conf gives you `getaddressbalance`/`getaddressutxos`/etc" | The conf flag exists but the corresponding RPC methods **do not exist in this binary** — every one of `getaddressbalance`, `getaddresstxids`, `getaddressutxos`, `getaddressdeltas`, `getaddressmempool`, `getspentinfo` returns `help: unknown command`. The indexer must build its own address index from scratch with no shortcut. | `40-addr-rpc-probe.txt` |
| 8 | ZMQ is the right block/mempool event source | `getzmqnotifications` returns `[]`. No ZMQ topics are configured. Indexer must poll. | `05-zmq.json` |
| 9 | The Falcon witness format is something I'd have to read C++ for | I do still need the source for the script-recognition rules, but the on-the-wire format is plain BIP141 SegWit v0 P2WPKH with Falcon bytes inside the stack: `[falcon_sig(690), falcon_pubkey(898)]`. Marker, flag, and per-item compact-size headers are bog-standard. | `70-big.json`, sizes match `key.h:17-19` exactly |
| 10 | The genesis output is "some Falcon thing" | It's a **bare P2PK-Falcon** literally: `OP_PUSHDATA2 0x0382 <898-byte pubkey> OP_CHECKSIG`. Bitcoin Core classifies it as `nonstandard` because it doesn't recognise the push length. Our classifier must. | `11-genesis-block.json` |
| 11 | Spec mentions `OP_FALCONVERIFY` as a possible custom opcode | No evidence of any new opcode. Falcon verification is hooked into the existing `OP_CHECKSIG` codepath via the redefined `CPubKey::Verify()`. I haven't read `script/interpreter.cpp` yet but the witness format alone is enough to confirm no new opcodes are exposed at the script layer. | `pubkey.h:189` declares `Verify()` with the same signature as upstream |

## Assumptions I'm relying on that are still UNVERIFIED

1. The exact `GetBlockSubsidy()` formula. Critical for any "projected
   emission" UI element. Phase 4 must not display anything that depends on
   this until I've read `validation.cpp`.
2. That `Hash160(falcon_pubkey)` produces the witness program in the
   previous output of the big tx in `70-big.json`. I'd bet on it but I
   haven't actually executed the hash and compared.
3. That `p2pkh_falcon` (bare `OP_DUP OP_HASH160 ... OP_CHECKSIG` with a
   Falcon pubkey on the spending side) and native `tbc1q…` outputs both
   exist on mainnet. I've sampled neither — the busy block I picked
   happened to contain only P2SH outputs.
4. That the address index can be built incrementally without a full
   reindex from genesis. Likely fine, but the operator has not run the
   indexer end-to-end yet so there's no wall-clock estimate.
5. The default RPC port. Listed as a TODO in `rpc-surface.md`.

## What I'd cut if I had half the time

- **Native Falcon WASM verification (Phase 5).** It's the highest-risk
  feature with the lowest information density per pixel — the chain itself
  already verified every signature, so a green ✓ in the UI tells the user
  nothing they didn't already know. If forced to cut, I'd ship a tx-detail
  page that just *displays* the Falcon sig/pubkey hex with byte annotations
  (sizes, NTRU degree, q) and skip the in-browser verification entirely.
  Phase 0 alone justifies cutting this.
- **OP_RETURN protocol auto-detection (Phase 6).** Ship the raw hex +
  ASCII decode and the BTC-anchor matcher; skip per-protocol parsers
  (Omni, Stamps, etc.) until there's evidence anyone uses them on
  Tidecoin. The dump contains exactly one OP_RETURN type so far: the
  segwit witness commitment, which is consensus, not a protocol.
- **Mining-pool dominance over multiple windows (Phase 7).** Ship the
  144-block window only; the 1008/4032 windows are decoration.
- **Quantum simulator slider (Phase 4).** It was always going to be more
  speculation than data; with the corrected threat model (Shor doesn't
  apply, Grover doesn't either at 256-bit hashes), there's nothing
  interesting for the slider to control. Drop it. Replace with a static
  page explaining why Tidecoin is a non-issue under the standard threat
  model and what the residual risks actually are (Falcon cryptanalysis,
  side-channel leaks during signing, implementation bugs in pqclean).

## Concrete spec amendments going into Phase 1

These edits to the v2 spec are now binding for the implementation:

- §0.6 conf path: corrected to `~/.tidecoin/tidecoin.conf`. Data dir
  remains `/mnt/fast_nvme/tidecoin_data`.
- §4 schema, `outputs.script_type` enum: replace
  `'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2falcon' | 'op_return' | 'unknown'`
  with `'p2pk_falcon' | 'p2pkh_falcon' | 'p2sh' | 'p2wpkh_falcon' | 'p2wsh_falcon' | 'op_return' | 'nonstandard'`.
  There is no non-Falcon p2pkh on this chain.
- §6 quantum dashboard: drop the ECDSA/Falcon partition entirely. New
  partition documented in `docs/tidecoin-protocol.md` §4. The headline
  metric becomes "% of supply still hash-protected" (i.e. has not yet had
  its Falcon pubkey revealed on chain).
- §2.1 ZMQ: remove. Indexer polls.
- §4 indexer step 5 ("Detect mining pool from coinbase scriptSig"):
  confirmed feasible, real samples carry a `pool.<domain>` tag.

## What the file dump on the repo represents

Everything in [`docs/sample-responses/`](docs/sample-responses/) is a
verbatim capture from the operator's live node on 2026-04-07 against tip
height 2,503,300. Everything in [`docs/source-extracts/`](docs/source-extracts/)
is a verbatim copy from `https://github.com/tidecoin/tidecoin.git` rev
`7b525367e9ea1b614aa380a52394f0e3d3878aa9`. Both are committed to the repo
so future phases (and a skeptical reviewer) can audit any claim on these
pages back to the bytes it came from.

`archive/v1-TideExplorer.jsx` is the v1 single-file mock the spec orders
deleted. I've moved it to `archive/` rather than removing it outright so
the visual tokens are still extractable for Phase 3, but **no logic from it
is to be copied** per spec §0.1.
