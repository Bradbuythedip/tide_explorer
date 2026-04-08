/**
 * Single source of truth for every cryptographic / protocol term that
 * appears anywhere in prevblock's UI.
 *
 * DIRECTIVE.md §2.2: every mention of any term in this file, in any UI
 * surface, MUST be wrapped in a <Term name="..."> component backed by
 * this file. Grep for these terms outside <Term> should return zero
 * results. Enforced in CI before Phase A ships.
 *
 * Entries are intentionally short (2-3 sentences). The glossary is a
 * tooltip surface, not a textbook. For the long-form threat model see
 * docs/threat-model.md.
 *
 * Every entry cites either a source file in docs/source-extracts/ or a
 * section of docs/tidecoin-protocol.md so a reader can audit the claim.
 */

export interface GlossaryEntry {
  /** Short inline phrase used as the term label. */
  label: string;
  /** 2-3 sentence plain-English explanation for the tooltip. */
  short: string;
  /** Optional longer explanation shown on click / on the glossary page. */
  long?: string;
  /** Citations — file path + optional line reference. */
  sources: readonly string[];
  /**
   * Related term keys to render as links in the tooltip footer.
   * Typed as plain strings rather than `GlossaryTerm[]` to avoid a
   * circular type reference (GLOSSARY → GlossaryEntry → GlossaryTerm
   * → keyof typeof GLOSSARY). The `<Term>` component validates each
   * entry against the runtime GLOSSARY map and drops missing ones.
   */
  see?: readonly string[];
}

/**
 * Keys are the canonical machine names. Labels (what the user sees) are
 * in `.label`. Keep the keys kebab-case ASCII.
 */
export const GLOSSARY = {
  "falcon-512": {
    label: "Falcon-512",
    short:
      "Lattice-based post-quantum signature scheme. Tidecoin uses it for every signature on the chain. Public keys are 897 bytes and signatures are 690 bytes.",
    long:
      "Falcon-512 is a NIST-standardised signature scheme built on NTRU lattices (degree N=512, modulus q=12289). It is what replaces ECDSA on Tidecoin. Every on-chain signature — genesis coinbase included — is Falcon-512; there is no ECDSA code path retained in the fork. NIST classifies it at security level 1 (≈ AES-128 against quantum search).",
    sources: [
      "docs/source-extracts/key.h:17-19",
      "docs/source-extracts/pubkey.h:36-64",
      "docs/tidecoin-protocol.md#3-the-single-signature-scheme-falcon-512",
    ],
    see: ["lattice-cryptography", "ntru", "shor"],
  },

  "hash-protected": {
    label: "hash-protected",
    short:
      "An address whose Falcon public key has never appeared on chain. The only way to attack it is to break the Hash160 that guards it (still ≈128-bit secure even against Grover).",
    long:
      "When you receive coins to a P2PKH, P2WPKH, or P2SH-wrapped output on Tidecoin, the Falcon public key is hashed with RIPEMD160(SHA256(...)) and only the 20-byte hash is stored on chain. An attacker has to break that hash to learn the public key before they can attack the signature scheme. Hash160 against Grover is ~128-bit work — computationally infeasible for the foreseeable future.",
    sources: [
      "docs/tidecoin-protocol.md#4-quantum-risk-model-corrected",
      "docs/threat-model.md#grover-vs-the-address-hash",
    ],
    see: ["pubkey-exposed", "grover", "hash160", "p2wpkh-falcon"],
  },

  "pubkey-exposed": {
    label: "pubkey-exposed",
    short:
      "An address whose Falcon public key has appeared in at least one input witness on chain. The Hash160 barrier is gone; security reduces to Falcon-512 itself.",
    long:
      "Spending from an address reveals its Falcon public key in the witness. If any coins remain on that address (or are received to it again after the spend), their only remaining protection is Falcon-512's own security. That is still believed safe, but it removes the Grover-resistant hash layer and places the coins' safety entirely on future Falcon cryptanalysis holding up. Consolidating pubkey-exposed UTXOs into a fresh P2WPKH output re-hides the pubkey behind a new Hash160 — the same reason you don't reuse Bitcoin addresses.",
    sources: [
      "docs/tidecoin-protocol.md#4-quantum-risk-model-corrected",
      "docs/threat-model.md#cryptanalysis-of-falcon-itself",
    ],
    see: ["hash-protected", "bare-p2pk", "falcon-512"],
  },

  "bare-p2pk": {
    label: "bare P2PK",
    short:
      "A Tidecoin output that stores the Falcon public key directly in the scriptPubKey, followed by OP_CHECKSIG. The genesis coinbase is the canonical example.",
    long:
      "A bare P2PK-Falcon output has the shape `OP_PUSHDATA2 0x8203 <898-byte pubkey> OP_CHECKSIG`. From a threat perspective, bare P2PK is equivalent to a pubkey-exposed address: the Falcon public key is on chain from the moment the output exists, so Falcon-512 is the only remaining barrier to spending.",
    sources: [
      "docs/tidecoin-protocol.md#31-genesis-output-bare-p2pk-falcon",
    ],
    see: ["pubkey-exposed", "falcon-512", "p2pk-falcon"],
  },

  shor: {
    label: "Shor's algorithm",
    short:
      "A quantum algorithm that breaks RSA and ECDSA by solving discrete logarithms in polynomial time. Does NOT apply to Tidecoin — Falcon-512 is lattice-based, not discrete-log-based.",
    long:
      "Shor's algorithm is the headline quantum threat to Bitcoin: a sufficiently large quantum computer running Shor's can recover a private ECDSA key from a published public key. It has no known speedup for breaking lattice problems, which is why post-quantum signature schemes like Falcon exist. On Tidecoin there is no ECDSA code path anywhere in the binary, so Shor is not a concern at all — not 'less of a concern,' but 'does not apply.'",
    sources: [
      "docs/source-extracts/key.h:17-19",
      "docs/threat-model.md",
    ],
    see: ["grover", "falcon-512", "crqc"],
  },

  grover: {
    label: "Grover's algorithm",
    short:
      "A quantum algorithm that roughly halves the effective bit-security of hash functions. Against 256-bit hashes it drops security from 256 bits to ~128 bits, which is still infeasible to attack.",
    long:
      "Grover's algorithm gives a quadratic speedup to black-box search, which includes preimage attacks on cryptographic hashes. On Hash160 (RIPEMD160∘SHA256) it reduces the pre-image work from 2^160 to ~2^80, which sounds alarming but is still ~1024x harder than the biggest publicly-known classical hash collision effort. The real-world takeaway: hash-protected Tidecoin addresses are still safe, but the safety margin is finite, and it's the reason prevblock tracks hash-protected fraction as a distinct metric.",
    sources: [
      "docs/threat-model.md#grover-vs-the-address-hash",
    ],
    see: ["hash-protected", "hash160", "shor"],
  },

  crqc: {
    label: "CRQC",
    short:
      "Cryptographically Relevant Quantum Computer — a hypothetical quantum machine with enough logical qubits and gate fidelity to break deployed public-key cryptography. None exists today.",
    long:
      "Published estimates for breaking ECDSA-256 are on the order of 520 logical qubits if using the carry-reuse optimisation of Gidney 2019. Publicly-announced quantum machines are several orders of magnitude short of that capability. Tidecoin's posture is to be ready whether a CRQC appears tomorrow or in forty years; the chain's signatures are already Falcon, so a CRQC arriving does not, by itself, endanger any TDC.",
    sources: [
      "docs/threat-model.md",
    ],
    see: ["shor", "falcon-512"],
  },

  "hash160": {
    label: "Hash160",
    short:
      "RIPEMD160 of SHA256 of the public key. The 20-byte address fingerprint used by P2PKH, P2WPKH, and P2SH outputs on Tidecoin, inherited from Bitcoin.",
    sources: [
      "docs/source-extracts/script/standard.cpp:59",
    ],
    see: ["hash-protected", "grover"],
  },

  "p2pk-falcon": {
    label: "P2PK-Falcon",
    short:
      "A non-standard output that stores the 898-byte Falcon public key directly followed by OP_CHECKSIG. Most common example: the genesis coinbase.",
    sources: [
      "docs/tidecoin-protocol.md#31-genesis-output-bare-p2pk-falcon",
    ],
    see: ["bare-p2pk", "falcon-512"],
  },

  "p2wpkh-falcon": {
    label: "P2WPKH-Falcon",
    short:
      "A native-segwit v0 output whose witness stack holds a 690-byte Falcon signature and an 898-byte Falcon public key. Serialisation is standard BIP141; only the bytes inside differ.",
    sources: [
      "docs/tidecoin-protocol.md#32-modern-outputs-p2sh-wrapped-p2wpkh-falcon",
      "docs/sample-responses/70-big.json",
    ],
    see: ["hash-protected", "falcon-512"],
  },

  "p2sh": {
    label: "P2SH",
    short:
      "Pay-to-Script-Hash. The output commits to the Hash160 of a redeem script, which is revealed at spend time. On Tidecoin mainnet these addresses start with `T…` (version byte 65).",
    sources: [
      "docs/source-extracts/chainparams.cpp:130",
    ],
    see: ["hash160", "hash-protected"],
  },

  "lattice-cryptography": {
    label: "lattice cryptography",
    short:
      "A family of post-quantum schemes whose security reduces to hard problems in high-dimensional lattices, such as SVP and LWE. Falcon is lattice-based.",
    sources: [],
    see: ["falcon-512", "ntru"],
  },

  "ntru": {
    label: "NTRU",
    short:
      "A specific lattice structure used by Falcon. Falcon-512 uses NTRU with degree N=512 and modulus q=12289.",
    sources: [
      "docs/source-extracts/key.h:17-19",
    ],
    see: ["lattice-cryptography", "falcon-512"],
  },

  "side-channel": {
    label: "side-channel",
    short:
      "Information leakage from an implementation's physical behaviour (timing, power, EM) rather than the math. The biggest near-term risk to Falcon in practice, particularly for its Gaussian sampler.",
    long:
      "Guerreau, Martinelli, Ricosset and Rossi (2022) demonstrated a practical side-channel attack on the reference Falcon implementation's floating-point Gaussian sampler. The attack recovers the signing key from on-device traces. Wallet vendors implementing Falcon on devices without trustworthy constant-time floating-point operations are therefore a real risk surface today — not a hypothetical. This is why prevblock ranks implementation bugs as the highest of the three residual risks in docs/threat-model.md.",
    sources: [
      "docs/threat-model.md#implementation-bugs-and-side-channels",
    ],
    see: ["falcon-512"],
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryTerm = keyof typeof GLOSSARY;

/** Runtime lookup used by the <Term> component. */
export function lookupGlossary(term: GlossaryTerm): GlossaryEntry {
  return GLOSSARY[term];
}

/** True iff the given string is a valid glossary term key. */
export function isGlossaryTerm(key: string): key is GlossaryTerm {
  return Object.prototype.hasOwnProperty.call(GLOSSARY, key);
}

/**
 * Resolve the `see` list on an entry into valid terms + dropped keys.
 * Used by the `<Term>` component so a typo in a `see` array shows up
 * in dev instead of silently rendering a broken link.
 */
export function resolveSeeAlso(
  entry: GlossaryEntry,
): { valid: GlossaryTerm[]; dropped: string[] } {
  const valid: GlossaryTerm[] = [];
  const dropped: string[] = [];
  for (const key of entry.see ?? []) {
    if (isGlossaryTerm(key)) valid.push(key);
    else dropped.push(key);
  }
  return { valid, dropped };
}
