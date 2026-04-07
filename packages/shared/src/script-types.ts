/**
 * prevblock's script-type taxonomy.
 *
 * See docs/tidecoin-protocol.md §3.3. Tidecoin's own Solver() cannot
 * recognize `p2pk_falcon` (see §3.1 — the 898-byte public key cannot fit
 * in the single-byte push length that upstream MatchPayToPubkey expects),
 * so the node's `scriptPubKey.type` is NOT authoritative. The indexer
 * MUST re-classify every output using the rules below.
 */

export const SCRIPT_TYPES = [
  /** OP_PUSHDATA2 0x0382 <898B Falcon pubkey> OP_CHECKSIG (genesis output). */
  "p2pk_falcon",
  /** OP_DUP OP_HASH160 <20B> OP_EQUALVERIFY OP_CHECKSIG — Hash160 of Falcon pubkey. */
  "p2pkh_falcon",
  /** OP_HASH160 <20B> OP_EQUAL. */
  "p2sh",
  /** OP_0 <20B> — BIP141 P2WPKH, witness stack is [falcon_sig, falcon_pubkey]. */
  "p2wpkh_falcon",
  /** OP_0 <32B> — BIP141 P2WSH, witness contains a redeemscript. */
  "p2wsh_falcon",
  /** OP_RETURN ... — provably unspendable, may carry attestation data. */
  "op_return",
  /** Any witness program with version > 0 we don't yet know what to do with. */
  "witness_unknown",
  /** Anything the classifier doesn't match. */
  "nonstandard",
] as const;

export type ScriptType = (typeof SCRIPT_TYPES)[number];

/**
 * Falcon-512 sizes, verbatim from docs/source-extracts/key.h lines 17-19.
 * Never hard-code these elsewhere; import from here.
 */
export const FALCON = {
  /** PQCLEAN_FALCON512_CLEAN_CRYPTO_SECRETKEYBYTES_ */
  SECRET_KEY_SIZE: 1281,
  /** PQCLEAN_FALCON512_CLEAN_CRYPTO_PUBLICKEYBYTES_ (raw, on-the-wire). */
  PUBLIC_KEY_SIZE_RAW: 897,
  /**
   * CPubKey::PUBLIC_KEY_SIZE in pubkey.h:36 — 897+1 = 898.
   * The +1 is a leading type byte stored by CPubKey but not used for
   * anything: GetLen() ignores it and always returns 898.
   */
  PUBLIC_KEY_SIZE: 898,
  /** PQCLEAN_FALCON512_CLEAN_CRYPTO_BYTES_ — detached signature length. */
  SIGNATURE_SIZE: 690,
  /** NTRU polynomial degree. */
  N: 512,
  /** NTRU modulus. */
  Q: 12289,
} as const;
