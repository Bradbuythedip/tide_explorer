# Tidecoin threat model — honest version

> This document is the long-form source for `packages/shared/glossary.ts`
> and for the onboarding Slide 2 copy (`DIRECTIVE.md` §2.1). Everything on
> this page is either a quoted source line from the chain/binary or a
> citation to published academic work. Marketing copy does not belong
> here — write it in the UI layer and cite back.

## The threat that does **not** apply

**Shor's algorithm.** This is the famous quantum attack on Bitcoin. A
sufficiently large quantum computer running Shor's can recover an ECDSA
private key from a published public key in polynomial time. It is the
reason post-quantum signature schemes exist.

**It does not apply to Tidecoin.** There is no ECDSA code path in the
binary. Every key — private, public, and every signature in every witness
on the chain — is Falcon-512:

```c
// docs/source-extracts/key.h:17-19
#define PQCLEAN_FALCON512_CLEAN_CRYPTO_SECRETKEYBYTES_   1281
#define PQCLEAN_FALCON512_CLEAN_CRYPTO_PUBLICKEYBYTES_   897
#define PQCLEAN_FALCON512_CLEAN_CRYPTO_BYTES_            690
```

Shor provides no known speedup for the NTRU lattice problems Falcon-512
rests on. A cryptographically-relevant quantum computer arriving tomorrow
would, on its own, not endanger any TDC.

This is not a weakening of the threat, or a "we think it's okay" — it is a
categorical "does not apply." Onboarding copy should say so in those terms.

## The threats that **do** apply

Three, in descending order of how likely they are to cause a real loss in
the next five years.

### 1. Implementation bugs and side-channels (highest near-term risk)

Tidecoin signs transactions using the PQClean Falcon-512 reference
implementation. That implementation's Gaussian sampler is built on
floating-point arithmetic, and the floating-point operations have
observable timing variations on many CPUs.

**Concrete prior art:** Guerreau, Martinelli, Ricosset & Rossi, *"The Hidden
Parallelepiped is Back Again: Power Analysis Attacks on Falcon"*, CHES 2022.
The authors recover Falcon signing keys from real measurements on the
reference implementation running on an ARM Cortex-M4. The attack does not
require fault injection or invasive access; it is a clean side-channel
recovery.

**Operational implication for Tidecoin users:**

- Signing on a general-purpose CPU without constant-time floating-point
  guarantees is a risk. Most desktops and phones fall into this category.
- Hardware wallets implementing Falcon need to use either a masked
  integer-only sampler or a certified constant-time FP unit. At time of
  writing (April 2026), no shipped consumer hardware wallet advertises
  Falcon support with masked sampling, so this risk is borne by every
  Tidecoin user signing a transaction today.
- An attacker who can observe a single signing (physical proximity,
  malicious app on the same device, co-tenant on a cloud VM) may be
  able to recover the secret key from one or a few signatures.

**What prevblock does about it:** surfaces it in the threat model tooltip.
This is an ecosystem problem a block explorer cannot solve; the explorer's
job is to make sure users are aware of it when deciding where to store
coins.

### 2. Cryptanalysis of Falcon itself

Lattice cryptanalysis is an active research area. Falcon-512 is NIST
level 1 (~AES-128 classical, ~AES-128 against quantum search), which gives
a conservative margin today but is *not* the sort of margin one can leave
unmonitored for twenty years.

**Concrete prior art:** Falcon's underlying NTRU assumption has survived
steady academic scrutiny since 1996. No practical break exists. But:
- Recent (2020-2024) improvements in BKZ-style lattice reduction have
  shaved bits of security off several lattice schemes without breaking
  them.
- Structured lattices (Falcon uses a ring structure for efficiency) have
  attracted attacks that exploit the ring structure specifically. Falcon's
  NTRU is considered among the better-studied structured lattices, but
  "better-studied among structured lattices" is a narrower claim than
  "equivalent to unstructured Regev-style LWE."

**Operational implication:** the conservative reader should assume a
non-zero probability that Falcon-512 loses security margin over the
chain's lifetime. The argument for hash-protecting addresses is that the
Hash160 barrier keeps coins safe even if Falcon itself is later weakened
to the point where recovering a pubkey from its signature becomes
feasible. Pubkey-exposed addresses do not have that insurance.

**What prevblock does about it:** makes hash-protected fraction a
first-class metric. The "consolidate pubkey-exposed UTXOs" nudge in §1
of the directive is specifically for this threat — re-hiding the pubkey
restores the insurance.

### 3. Grover vs the address hash

Grover's algorithm gives a quadratic speedup to black-box search, which
applies to pre-image attacks on cryptographic hashes. Against Tidecoin's
Hash160 (RIPEMD160 ∘ SHA256):

- Classical pre-image work: ~2^160
- Grover-accelerated work: ~2^80

2^80 is still ~10^9 × the largest publicly-known classical hash computation
campaigns (e.g. bitcoin mining at ~10^{23} hashes total since 2009). It is
not a near-term concern.

**Operational implication:** hash-protected Tidecoin addresses are safe
today. They are safe under the most aggressive credible Grover projections
for the next several decades. The value of tracking them is not "oh no,
hashes are broken" — it is the standard
defense-in-depth argument. If Falcon itself is later weakened (threat #2),
the Hash160 remains a meaningful barrier; if Grover makes unexpected
practical progress (threat #3), Falcon's 690-byte signature is unaffected.
Hash-protected coins have both layers; exposed coins have one.

## Why the triangle, not the sword-and-shield

The onboarding Slide 2 visual is a triangle with those three vertices, in
descending risk order (implementation bugs at the top, Falcon cryptanalysis
on the lower-left, Grover on the lower-right). It is not a quantum
"sword" vs PQ "shield" cartoon.

Rationale:
- The sword/shield metaphor tells a false story — it implies there is a
  single binary defence against a single threat. The real story is three
  independent risks with different time horizons and different mitigations.
- The triangle shape encodes the relative urgency visually: the top of the
  triangle is what a cautious user should worry about first, and it happens
  to be the risk least connected to the chain's cryptographic design and
  most connected to the ecosystem's wallet implementations.
- A cryptographer who lands on the site via bitcointalk should see their
  own mental model reflected, not a beginner cartoon they have to decode
  around.

## What prevblock does NOT claim

- That Tidecoin is "quantum-proof." The word is avoided throughout. The
  correct phrase is "post-quantum by construction" with an explicit
  acknowledgement of residual risks. Marketing copy that says "unbreakable
  by quantum computers" is at best sloppy and at worst a liability if
  threat #1 or #2 ever produces a concrete loss.
- That Falcon has been formally verified end-to-end. It has not.
- That the three risks are the only risks. They are the three that are
  public today and backed by published research. Monitoring this document
  for additions is part of the operator's responsibility.

## Citations

1. PQClean reference implementation of Falcon-512. `docs/source-extracts/key.h`
   lines 17-19; upstream at
   https://github.com/PQClean/PQClean/tree/master/crypto_sign/falcon-512/clean.
2. Guerreau, Martinelli, Ricosset, Rossi. "The Hidden Parallelepiped is Back
   Again: Power Analysis Attacks on Falcon." IACR Transactions on
   Cryptographic Hardware and Embedded Systems, 2022 (3).
   https://eprint.iacr.org/2022/781
3. Gidney. "Factoring with n+2 clean qubits and n-1 dirty qubits." 2019.
   Source for CRQC size estimates.
4. NIST Post-Quantum Cryptography Standardization Round 3 final report.
   Falcon security level 1 categorisation.
5. Tidecoin source tree: https://github.com/tidecoin/tidecoin at
   commit `7b525367e9ea1b614aa380a52394f0e3d3878aa9`
   (see `docs/sample-responses/90-source-rev.txt`).
