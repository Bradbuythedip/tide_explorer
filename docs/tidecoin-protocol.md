# Tidecoin protocol — observed facts

> Everything on this page is derived either from a verbatim RPC response in
> [`sample-responses/`](sample-responses/) or from the Tidecoin source files
> in [`source-extracts/`](source-extracts/), which were copied verbatim from
> `https://github.com/tidecoin/tidecoin.git` at commit
> `7b525367e9ea1b614aa380a52394f0e3d3878aa9`. **No claim on this page is
> sourced from the model's pretraining.** Anything not yet verified is marked
> `TODO/UNVERIFIED`.

## 1. Lineage and chain params

| Field | Value | Source |
|---|---|---|
| Codebase | Bitcoin Core **0.18.3** fork | `01-getnetworkinfo.json` `subversion` |
| Protocol version | 70015 | same |
| Mainnet genesis hash | `480ecc7602d8989f32483377ed66381c391dda6215aeef9e80486a7fd3018075` | `chainparams.cpp:115`, confirmed by `10-genesis-hash.txt` |
| Genesis time | 2020-12-27 19:09:40 UTC (`1609074580`) | `11-genesis-block.json` |
| Genesis subsidy | **50.00000000 TDC** to a single bare-Falcon-P2PK output | `11-genesis-block.json` `vout[0]` |
| Block target spacing | **60 seconds** | `chainparams.cpp:74` `nPowTargetSpacing = 60` |
| Difficulty retarget interval | 5 days (7,200 blocks) | `chainparams.cpp:73` `nPowTargetTimespan = 5*24*60*60` |
| Subsidy halving interval | **262,800 blocks** (~6 months) | `chainparams.cpp:66` |
| MAX_MONEY (sanity cap) | 21,000,000 × 10⁸ satoshi | `amount.h:25` |
| Current supply (tip = 2,503,300) | **18,810,773.12500000 TDC** across 877,897 UTXOs | `07-gettxoutsetinfo.json` |
| CSV / SegWit | both **always-active** from genesis | `chainparams.cpp:84-91` |
| BIP16/34/65/66 | active from height 1 | `chainparams.cpp:67-71` |

### Subsidy schedule — partially verified

A clean halving from 50 should give `50 / 2^9 = 0.09765625` at height
2,503,300 (9 halvings done, 9.5 since genesis). The observed coinbase output
at the tip is **0.625** TDC ([`21-tip-block.json`](sample-responses/21-tip-block.json)),
and at the busy block (height 2,503,201) it is **0.85420000** with no
non-coinbase fees of consequence ([`70-cb.json`](sample-responses/70-cb.json)).
Neither matches the textbook `50 >> n` curve.

Possibilities:
1. The subsidy formula is not a simple right-shift (custom curve in
   `validation.cpp::GetBlockSubsidy` — **not yet captured**, see TODO below).
2. There is a permanent dev/founder reward subtracted before the coinbase
   payout.
3. The `262800` interval is correct but the base subsidy is much smaller
   than 50 TDC outside genesis (a one-off premine).

**TODO** pull `src/validation.cpp` from the source tree and document the
exact `GetBlockSubsidy()` function. Until that's done, do **not** display a
"projected emission curve" anywhere in the explorer.

## 2. Address types

From `chainparams.cpp:128-135` (mainnet):

| Type | Version byte | Leading char (observed) |
|---|---|---|
| `PUBKEY_ADDRESS` (P2PKH-Falcon) | 33 | `F…` |
| `SCRIPT_ADDRESS` (P2SH primary) | 70 | `V…` |
| `SCRIPT_ADDRESS2` (P2SH secondary) | 65 | **`T…`** ← what's actually on chain |
| `SECRET_KEY` (WIF) | 125 | `7…` |
| `bech32_hrp` | **`tbc`** | native segwit addresses are `tbc1q…`, **not** `tdc1q…` |

Every non-coinbase address observed in the busy block
([`31-busy-block.json`](sample-responses/31-busy-block.json),
[`70-big.json`](sample-responses/70-big.json)) is `T…` — i.e. P2SH under the
secondary prefix. Examples: `TCxVyGcc3UL9L8yRmCSqqayafAsE6G7JhX`,
`TQc9H8vsG3Ls5MjcCdjSLPc38CBcea7frv`. **TODO** capture a P2PKH (`F…`) and
a native segwit (`tbc1q…`) sample to confirm the encoding works in
`validateaddress` for those too.

## 3. The single signature scheme: Falcon-512

This is the headline correction. The v2 spec assumes Tidecoin has both ECDSA
and Falcon and the explorer's job is to partition coins between them. **It
doesn't.** Every key on the chain is Falcon-512.

From [`source-extracts/key.h:17-19`](source-extracts/key.h) (verbatim):

```c
#define PQCLEAN_FALCON512_CLEAN_CRYPTO_SECRETKEYBYTES_   1281
#define PQCLEAN_FALCON512_CLEAN_CRYPTO_PUBLICKEYBYTES_   897
#define PQCLEAN_FALCON512_CLEAN_CRYPTO_BYTES_            690
```

`CKey::PRIVATE_KEY_SIZE`, `CPubKey::PUBLIC_KEY_SIZE`, and
`CPubKey::SIGNATURE_SIZE` are all defined in terms of those Falcon constants,
with **no `secp256k1` codepath retained**. `CPubKey::GetLen()` is hard-coded
to return `PUBLIC_KEY_SIZE = 898` regardless of the leading byte
([`source-extracts/pubkey.h:36-64`](source-extracts/pubkey.h)).

Sizes:

| Object | Bytes |
|---|---|
| Falcon-512 secret key | 1,281 |
| Falcon-512 public key | 897 (+1 leading byte stored on disk → 898) |
| Falcon-512 signature | 690 |

Falcon-512 NIST security level is 1 (≈ AES-128), N = 512, q = 12289.

### 3.1 Genesis output: bare P2PK-Falcon

The genesis coinbase (`50.00 TDC`) pays to:

```
OP_PUSHDATA2 0x0382  <898 bytes Falcon pubkey>  OP_CHECKSIG
```

Decoded scriptPubKey hex starts with `4d8203` (= `OP_PUSHDATA2` + length
`0x0382 = 898`) and ends with `ac` (`OP_CHECKSIG`).

**Tidecoin's own `Solver()` cannot recognize this output.** From
[`source-extracts/script/standard.cpp:46`](source-extracts/script/standard.cpp):

```cpp
static bool MatchPayToPubkey(const CScript& script, valtype& pubkey) {
    if (script.size() == CPubKey::PUBLIC_KEY_SIZE + 2 &&
        script[0] == CPubKey::PUBLIC_KEY_SIZE &&    // expects 1-byte push len
        script.back() == OP_CHECKSIG) { ... }
```

`PUBLIC_KEY_SIZE = 898`, which cannot fit in a single push-length byte —
any 898-byte push must use `OP_PUSHDATA2`. So `script[0]` is `0x4d`
(`OP_PUSHDATA2`), not 898, and the comparison **never** matches. Every
bare-Falcon P2PK output on the chain (including genesis) falls through to
`TX_NONSTANDARD` in the upstream classifier. That's why
`getrawtransaction` reports `"type": "nonstandard"` for the genesis output
in [`11-genesis-block.json`](sample-responses/11-genesis-block.json).

**Indexer rule:** before falling through to `nonstandard`, additionally
check for the pattern `4d 82 03 <898 bytes> ac` and emit
`script_type = 'p2pk_falcon'`. This is functionality the node itself does
not provide and is genuine value-add of the explorer.

The genesis coinbase scriptSig contains the easter-egg headline:

> `aspectrum.ieee.org 09/Dec/2020 Photonic Quantum Computer Displays 'Supremacy' Over Supercomputers.`

(The `a` is the ASCII length byte for the rest of the string.)

### 3.2 Modern outputs: P2SH-wrapped P2WPKH-Falcon

[`70-big.json`](sample-responses/70-big.json) is a transaction at height
~2,503,200 spending one input. Its `scriptSig` is

```
1600145c249a1ce7fe76eb4187d03705845df9a4013472
└─push 22── ─ │ ─── 20-byte hash160 ───
              0x00 = witness v0
```

i.e. a textbook BIP141 P2SH-P2WPKH redeem script (`OP_0 <20-byte hash>`).
The witness has exactly two stack items:

| Item | Length | What it is |
|---|---|---|
| `txinwitness[0]` | **690 bytes** | Falcon-512 signature (matches `CRYPTO_BYTES = 690` exactly) |
| `txinwitness[1]` | **898 bytes** | Falcon-512 public key (matches `PUBLIC_KEY_SIZE = 897+1` exactly) |

**Conclusion:** Tidecoin reuses BIP141 SegWit v0 P2WPKH unchanged at the
serialization level. Marker (`0x00`), flag (`0x01`), witness stack length,
and per-item compact-size lengths are all standard BIP141. The only
difference is the **bytes inside the stack items**: Falcon signature and
Falcon public key in place of ECDSA's ~71-byte DER sig and 33-byte
compressed pubkey. The witness program in the previous output (the 20-byte
hash) is `Hash160(falcon_pubkey || …)`. **TODO/UNVERIFIED:** confirm by
hashing `txinwitness[1]` and matching it to the previous-output's
`witnessProgram`. (We don't have the prevout in the dump yet — needs a
second RPC call. The indexer will do this on every tx anyway.)

### 3.3 Output script types the indexer must recognise

| script_type | scriptPubKey shape | observed in dump |
|---|---|---|
| `p2pk_falcon` | `OP_PUSHDATA2 0x0382 <898B> OP_CHECKSIG` | yes — genesis |
| `p2pkh_falcon` | `OP_DUP OP_HASH160 <20B> OP_EQUALVERIFY OP_CHECKSIG` | not yet sampled (TODO) |
| `p2sh` | `OP_HASH160 <20B> OP_EQUAL` | yes — busy block (`T…` addresses) |
| `p2wpkh_falcon` | `OP_0 <20B>` | not yet sampled at scriptPubKey level (TODO; observed only as a P2SH wrapping in busy block) |
| `p2wsh_falcon` | `OP_0 <32B>` | not yet sampled (TODO) |
| `op_return` | `OP_RETURN <push…>` | yes — coinbase witness commitment `aa21a9ed…` |
| `nonstandard` | anything else | catch-all |

The two TODO rows must be sampled before Phase 2 (the indexer) ships;
otherwise the script-type classifier is guessing.

## 4. Quantum-risk model — corrected

Because every signature on this chain is already Falcon-512:

- **Shor's algorithm does not threaten any output on Tidecoin.** Falcon is a
  lattice scheme; ECDLP-breaking quantum computers don't apply.
- The only quantum threat that exists at all is **Grover** speeding up
  brute-forcing the hash that protects a P2(W)PKH address before it has
  been spent from. Grover takes 256-bit hash security down to ~128 bits,
  which is still safe.
- Once an address is spent from (i.e. a Falcon pubkey is revealed in a
  witness), the residual security against a future cryptanalytic attack on
  Falcon-512 itself is the underlying NTRU lattice's classical/quantum
  security level (≈ NIST level 1, ≈ AES-128 against quantum search).

So the v2 spec's three-bucket model (PQ-safe / hash-protected ECDSA /
exposed ECDSA) collapses. The **honest** dashboard partition for Tidecoin is:

1. **Hash-protected Falcon** — UTXOs in `p2pkh_falcon`, `p2wpkh_falcon`, or
   `p2sh` outputs whose Falcon pubkey has not yet been revealed on chain.
   Protected by Hash160 + Falcon. Maximum safety.
2. **Pubkey-exposed Falcon** — UTXOs whose Falcon pubkey *has* appeared in
   some prior input witness on chain (the indexer tracks this exactly the
   way the spec describes). Still secure today, but their security floor is
   now "Falcon-512 itself", not "Falcon + Hash160".
3. **Bare-Falcon (P2PK) outputs** — same exposure as 2, but the pubkey was
   never hidden in the first place. Genesis is the obvious example.

The Quantum Dashboard (Phase 4) will be rebuilt around **this** partition.
The educational tooltips need to drop the Shor framing entirely.

## 5. Coinbase / mining

- The genesis coinbase scriptSig contains the easter-egg headline (see §3.1).
- Modern coinbase scriptSigs in the dump (`12-genesis-coinbase.json`,
  `70-cb.json`) include `fabe6d6d…` AuxPoW-style merge-mining tags and
  pool-tag strings such as `0f706f6f6c2e72706c616e742e78797a` =
  `pool.rplant.xyz`. The miner-tag scanner can use the same
  bytes-to-text-after-`/`-or-newline heuristic as Bitcoin block explorers.
- Coinbase outputs include the standard SegWit witness commitment OP_RETURN
  (`6a24aa21a9ed…`) and the actual subsidy payment (a P2SH `T…` address in
  the observed blocks).

## 6. ZMQ / sync strategy

`getzmqnotifications` returns `[]` on this node, and the conf does not set
`zmqpub*=` anywhere. The indexer **must poll** — there is no event stream.
Recommended cadences:

- New blocks: `getbestblockhash` every 1 s. On change, walk forward from
  `last_indexed_height`.
- Mempool: `getrawmempool true` every 2 s, diff against last snapshot.

## 7. Open items before Phase 1 ships

The following are still inferences and need a second RPC sample to become
facts. None of them block writing the RPC client + Fastify skeleton, but all
of them block the indexer (Phase 2):

1. `GetBlockSubsidy()` exact formula (see §1).
2. Sample of a `p2pkh_falcon` output (`F…` address) to confirm the bare
   Falcon-pubkey-hash form is what `validateaddress` reports.
3. Sample of a native `tbc1q…` segwit output to confirm native-v0 outputs
   exist on mainnet at all.
4. Hash160 of `txinwitness[1]` from the big tx vs the previous output's
   witness program — confirms the P2WPKH-Falcon hashing rule.
5. Default RPC port (chainparams `nDefaultPort`-equivalent for RPC; we have
   `8755` as the P2P port from `getnetworkinfo`).
6. Whether the `MAX_MONEY = 21M` cap is actually hit by the emission curve,
   or whether the supply asymptotes well below 21M. Current supply is
   18.81M out of 21M with halving every 6 months — this is consistent with
   approaching the cap.
