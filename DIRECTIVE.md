# prevblock — Improvement Directive (Phase 0 corrected)

> For Claude Code. Read this end-to-end before touching any file.
> Apply on top of the v2 spec (`SPEC.md`). Where this directive conflicts with
> the v2 spec, this wins. Where this directive conflicts with `PHASE_0_RETRO.md`
> or `docs/tidecoin-protocol.md`, Phase 0 wins — the chain is ground truth, the
> directive is intent.

---

## 0. Preamble — amendments from Phase 0

An earlier draft of this directive was written from generic Bitcoin-fork PQ
assumptions, not from what's actually on Tidecoin's chain. Five things were
wrong in that draft. This version corrects them up front so the rest of the
document is internally consistent with reality.

1. **Bech32 HRP is `tbc`, not `tdc1q`.** Native segwit addresses on Tidecoin
   are `tbc1q…`. `tdc1q` does not exist anywhere on the chain. Source:
   [`docs/source-extracts/chainparams.cpp`](docs/source-extracts/chainparams.cpp)
   line 135. Every UI string, validator, tooltip, and onboarding slide in
   this directive uses `tbc1q`. Observed mainnet addresses are almost
   exclusively `T…` (P2SH under the SCRIPT_ADDRESS2 version byte 65 — see
   `chainparams.cpp:130`).

2. **There is no ECDSA on Tidecoin.** Every key on the chain — private,
   public, and every signature in every witness — is Falcon-512. Source:
   [`docs/source-extracts/key.h`](docs/source-extracts/key.h) lines 17-19
   hard-wire `PRIVATE_KEY_SIZE`, `PUBLIC_KEY_SIZE`, and `SIGNATURE_SIZE` to
   the PQClean Falcon-512 constants (1281 / 897 / 690). No secp256k1
   codepath is retained. The "migrate from ECDSA to PQ" framing in the
   draft directive is a false conceptual model and is removed from this
   version entirely.

3. **The threat partition is not PQ-safe / hash-protected ECDSA /
   exposed ECDSA.** It is three-bucket within Falcon:

   | Bucket | Meaning | Residual security |
   |---|---|---|
   | **hash-protected Falcon** | Output in `p2pkh_falcon`, `p2wpkh_falcon`, `p2wsh_falcon`, or `p2sh` where the Falcon pubkey has never appeared on chain | Hash160(Falcon pubkey) + Falcon-512. Grover against SHA-256 ≈ 128-bit effective, still infeasible. |
   | **pubkey-exposed Falcon** | Output whose Falcon pubkey has appeared in a prior input witness on chain (it was spent from once, and the witness revealed the pubkey) | Falcon-512 itself, with the Hash160 barrier gone |
   | **bare P2PK-Falcon** | `OP_PUSHDATA2 0x8203 <898B pubkey> OP_CHECKSIG` (genesis coinbase form; the upstream `Solver()` blind spot — see `docs/tidecoin-protocol.md` §3.1) | Same as pubkey-exposed: Falcon-512 only, no hash barrier |

   Source: [`docs/tidecoin-protocol.md`](docs/tidecoin-protocol.md) §4.

4. **"Personal migration action" is not "move to `tdc1q`".** It is
   *"consolidate your pubkey-exposed UTXOs into a fresh hash-protected
   output to re-hide your Falcon public key."* Re-exposing the pubkey
   converts the address from Grover-only security back to
   dependent-on-Falcon-cryptanalysis security — the same logical structure
   as "don't reveal your public key until you have to," just with
   cryptographically correct content. Tooltip copy in §2.2 must explain
   *why*, not just *what*.

5. **The §6 comparison headline number is not "PQ-secure %".** On Tidecoin
   that number is 100% by construction (same as Dilithion), and the
   comparison is boring and true. The *interesting* TDC-specific number is
   the **hash-protected fraction** (what % of supply still has its Falcon
   pubkey hidden behind a Hash160). Make that the headline; footnote the
   "100% PQ" comparison as the trivially-true baseline.

The rest of this document is the amended directive. Section numbers track
the original for diffability.

---

## 1. "My Tidecoin" — the keystone feature

Unchanged in intent. Corrected in detail.

**What it is:** A user-populated panel where the visitor pastes one or more
TDC addresses. Stored client-side only — IndexedDB, no auth, no server, no
account, no email. The site never learns who the user is.

**Scope:**

1. A "My Tidecoin" entry in the header nav. Click → opens a drawer or
   modal reachable from every page.
2. Add address: paste, validate, store in IndexedDB under `mytdc:addresses`.
   Validator accepts `tbc1q…` (mainnet native segwit), `T…` (mainnet P2SH,
   version 65), `V…` (mainnet P2SH, version 70), and `F…` (mainnet P2PKH,
   version 33). Rejects everything else inline with a plain-English hint.
3. For each stored address, fetch via the public API: balance, last
   activity, **three-bucket Falcon partition** (hash-protected /
   pubkey-exposed / bare P2PK — per §0 amendment #3).
4. Aggregate across all addresses into a personal scorecard:
   - Total balance (TDC satoshis as bigint, displayed as fixed-8-decimal
     TDC; USD only if a price feed actually exists — do not invent one).
   - Personal three-bucket Falcon partition: X% hash-protected,
     Y% pubkey-exposed, Z% bare P2PK.
   - Personal migration action: *"Consolidate N TDC of pubkey-exposed
     UTXOs into a fresh hash-protected output to re-hide your Falcon
     public key."* List the specific UTXOs. Tooltip explains:
     *"Spending re-exposed the pubkey in the witness. Moving the coins to
     a fresh P2WPKH output hides it behind a new Hash160 again — the
     same reason you don't reuse Bitcoin addresses."*
5. Once at least one address is stored, show a persistent header chip on
   every page: `MY · 12.4 TDC · 78% hidden`. Click jumps to the panel.
6. Remove address: button per row, confirm dialog.
7. Export/import: JSON dump of the address list, so the user can move
   their watchlist between devices without the server ever seeing it.

**Anti-patterns:** unchanged from draft. No server-side identity, no
cookies, no fingerprinting, no `localStorage` (IndexedDB only).

**Acceptance:** Cold-load in incognito, paste a `T…` address (the actual
observed mainnet form), close the tab, reopen, see the address still
there. Network tab shows zero address-bearing analytics calls.

---

## 2. Conceptual-model fixes (Norman)

**2.1 First-visit onboarding.** Three slides, IndexedDB flag, skippable.
- **Slide 1 — "What is Tidecoin?"** Two sentences, one visual. Example
  copy: *"Tidecoin is a Bitcoin fork where every signature is Falcon-512,
  a lattice-based post-quantum algorithm. It's been live since
  December 2020 and has one-minute blocks."*
- **Slide 2 — "What quantum actually means here."** Corrected per §0
  amendment #2 and the "honest, every time" tonal direction. Copy sketch:
  > Shor's algorithm — the famous quantum attack that breaks Bitcoin's
  > ECDSA — does not apply to Tidecoin. Every signature on this chain is
  > Falcon-512 from genesis. There's nothing on the chain for Shor to
  > break.
  >
  > What **does** apply: three residual risks, none urgent today, all
  > worth watching.
  >
  > - **Grover vs the address hash.** Knocks 256-bit security down to
  >   ~128-bit. Still computationally infeasible.
  > - **Cryptanalysis of Falcon itself.** No break today, active research
  >   area, the reason keeping an upgrade path open matters.
  > - **Implementation bugs / side channels in Falcon signing.** The
  >   biggest actual risk today. See [`docs/threat-model.md`](docs/threat-model.md)
  >   for specifics and citations.
  >
  > prevblock tells you which of your coins are behind each layer of
  > protection. No urgency, just visibility.
  Visual: a triangle with those three vertices. Not a cartoon sword/shield.
- **Slide 3 — "What this site shows you."** Annotated screenshot of the
  dashboard with arrows.

**2.2 Glossary tooltips on every cryptographic term.** Single source of
truth at [`packages/shared/glossary.ts`](packages/shared/glossary.ts).
Terms covered (minimum):
`hash-protected`, `pubkey-exposed`, `bare-p2pk`, `Falcon-512`,
`Grover`, `Shor` (explicitly framed as "does not apply here, and why"),
`CRQC`, `p2pk_falcon`, `p2wpkh_falcon`, `p2sh`, `Hash160`, `NTRU`,
`lattice cryptography`, `side-channel`. Every UI mention of any of these
wraps in a `<Term name="...">` component backed by `glossary.ts`. Grep
for any of these strings outside `<Term>` → zero results. Enforced in CI
before Phase A ships.

**2.3 NotFound page diagnoses.**
- "Looks like a txid but is 63 chars instead of 64 — missing a character."
- "Looks like an address but starts with `1` — that's a Bitcoin mainnet
  prefix. Tidecoin addresses start with `T…`, `F…`, `V…`, or `tbc1q…`."
- "Looks like a block height but is larger than the current tip."
Build a classifier on the search input that returns the most likely
intended type and the specific problem.

**2.4 Feedback on state change.** `<NumberTicker>` flash on delta,
applied to KPI strip, ticker counts, gauges, header height.

**2.5 Narrative ticker phrases are individually navigable.** Unchanged.

**2.6 Search input constraints.** Inline hint: *"Enter a block height, a
64-char txid, or an address (`tbc1q…`, `T…`, `F…`, or `V…`)."*. Red border
on invalid, no submission.

---

## 3. Independence-axiom fixes (Suh)

**3.1 Block timeline single-purpose.** Remove the PQ-ratio gradient from
block cells. Keep the Shield icon on cells where `hash_protected_ratio >
0.9` (note the corrected metric — not "PQ ratio," because every tx is
PQ by construction).

**3.2 Dedicated sparkline.** Separate widget: last 144 blocks, y-axis
hash-protected % of block value (NOT "PQ %"). Label: *"Hash-protected
supply ratio, last 24h."*

**3.3 Narrative ticker decomposition.** Unchanged.

**3.4 Compact vs full dashboard mode.** Unchanged (IndexedDB flag, first
three visits → compact).

---

## 4. Information-axiom fixes (Suh)

**4.1 Color discipline pass, corrected legend.**
- **Emerald** = hash-protected Falcon.
- **Amber** = pubkey-exposed Falcon.
- **Rose** = bare P2PK-Falcon, *also* reserved for signal anomalies
  (a future "we detected a failed Falcon verification" banner uses rose).
- **Violet** = brand.
- **Cyan** = removed. Original spec used it for "ECDSA vs Falcon" contrast;
  there is no ECDSA, so there is no contrast, so the color has no job.
- **Slate** = neutral text/borders.
- **Miner palette** = blues, oranges, magentas, browns. No green, no
  emerald, no amber. Green means *unambiguously* "hash-protected."

**4.2 Widget count audit.** Unchanged.

---

## 5. Variable-reward additions (Hooked)

**5.1 Whale watch.** Unchanged.

**5.2 Fee alerts.** Unchanged. Web Notifications, opt-in per alert.

**5.3 Address watchlist notifications.** Unchanged. Requires §1 + WS.

**5.4 Genesis easter egg page.** `/genesis`. Displays the genesis
coinbase scriptSig with the ieee.org headline — *"spectrum.ieee.org
09/Dec/2020 Photonic Quantum Computer Displays 'Supremacy' Over
Supercomputers."* — and the genesis output (the bare P2PK-Falcon that
the node itself misclassifies as `nonstandard`, see
`docs/tidecoin-protocol.md` §3.1). Tell the story of both: the headline
ties Tidecoin's launch to the moment photonic QC supremacy was
announced, and the `nonstandard` mis-label is the most concrete example
of why prevblock exists — even Tidecoin's own node can't see what it's
looking at.

**5.5 Daily digest.** Unchanged.

---

## 6. Comparison view — TDC vs DIL vs BTC

Build `/compare`. Three columns. Rows (corrected per §0 amendment #5):

- Block time
- Current tip height
- Mempool size (tx count and MvB)
- Fee for next-block inclusion
- Signature scheme (TDC: Falcon-512; DIL: Dilithium; BTC: ECDSA/Schnorr)
- Avg signature + pubkey size on chain (TDC: 690 + 898 bytes; DIL: TBD;
  BTC: ~71 + 33 bytes)
- **Hash-protected supply % (headline metric, TDC-specific)**
- PQ-secure supply % (TDC: 100% by construction; DIL: 100% by
  construction; BTC: 0%) — presented as a one-line footnote, not the
  headline, because it's the boring true answer
- Total circulating supply
- 24h transaction count

Honesty clause unchanged: if DIL has a bigger mempool on a given day,
show it.

---

## 7. Anti-patterns — do not do these

Unchanged from draft.

---

## 8. Build order

Same phases as draft, but the backend ordering is dictated by
`PHASE_0_RETRO.md` and by the Phase 1 acceptance gate (§10).

**Phase A — Conceptual model (frontend, no chain data required)**
Can start in parallel with Phase 2 indexer against fixtures.

1. `packages/shared/glossary.ts` — single source of truth (ship in the
   same commit as this directive)
2. Glossary tooltips (§2.2)
3. First-visit onboarding (§2.1) — Slide 2 cites `docs/threat-model.md`
4. NotFound diagnostics (§2.3)
5. Search input constraints (§2.6)
6. Color discipline pass (§4.1)

**Phase B — Decoupling (frontend)**

7–11 per draft, using the corrected metric names (hash-protected, not
PQ).

**Phase C — My Tidecoin (the keystone)**

Blocked on the Phase 2 indexer's address endpoint. See §10.

12. IndexedDB schema + storage layer
13. Add/remove/list addresses UI
14. Per-address fetch via `/api/v1/address/:addr`
15. Personal three-bucket Falcon aggregation
16. Persistent header chip
17. Export/import JSON

**Phase D — Variable rewards**

Per draft.

---

## 9. Critical-step protocol

After every phase: `PHASE_X_RETRO.md`. Same template. Plus: on every
directive amendment (like this one), write a
`PHASE_0_AMENDMENT_RETRO.md` or equivalent listing the specific factual
errors the amendment corrected. That retro is for the directive author,
not the implementer — so the next directive doesn't repeat the pattern.

---

## 10. Definition of done

Unchanged tests 1–5 from the draft, corrected to:

- A green pixel on the site means **hash-protected** and nothing else.
  Miner palette green-free. Confirmed by visual audit.
- Grep for `PQ-secure` outside `<Term>` components and outside
  documentation → zero hits. The user-facing metric is
  **hash-protected %**.
- Grep for `tdc1q` anywhere in the codebase → zero hits. The prefix is
  `tbc1q`.
- Grep for `ECDSA` in UI copy → zero hits (appears only in docs and in
  the Slide 2 "what Shor attacks" explanation).
- Phase C `/api/v1/address/:addr` returns honest numbers. "Honest" means
  `scripts/verify-index.sh` has been run against the address's
  transactions and passes. **No UI ships personal numbers to a user
  until the verify script is green.** (Per user direction: the indexer
  can merge behind a feature flag and the address endpoint can read
  from it before verify passes, but the frontend is gated.)

Ship it.
