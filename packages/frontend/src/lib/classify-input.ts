/**
 * Search-input classifier.
 *
 * Used in two places:
 *   1. Search bar inline validation (DIRECTIVE.md §2.6): reject
 *      obviously-malformed input before submission and show what's
 *      wrong.
 *   2. NotFound page (DIRECTIVE.md §2.3): diagnose *why* the
 *      requested thing wasn't found, not just "no match."
 *
 * One source of truth for what a valid input looks like. If this
 * function accepts something the backend rejects, that's a bug —
 * and the user gets a clear message either way.
 *
 * Address families (chainparams.cpp:128-135):
 *   - tbc1...           bech32 native segwit, hrp 'tbc' (NOT 'tdc1q')
 *   - T...              base58check version 65 (SCRIPT_ADDRESS2, the
 *                       dominant P2SH form observed on mainnet)
 *   - V...              base58check version 70 (SCRIPT_ADDRESS)
 *   - F...              base58check version 33 (PUBKEY_ADDRESS)
 */

export type InputKind =
  | "block-height"
  | "block-hash"
  | "txid"
  | "address-bech32"
  | "address-p2sh-T"
  | "address-p2sh-V"
  | "address-p2pkh-F"
  | "partial-txid"
  | "unknown";

export interface ClassifyInputResult {
  kind: InputKind;
  /** True iff the input looks structurally valid for its kind. */
  valid: boolean;
  /** Human-readable diagnosis, especially for near-misses. */
  reason: string;
  /**
   * A concrete suggestion for the user, if we have one. e.g. "you
   * may be missing a character" or "did you paste a Bitcoin address?"
   */
  hint?: string;
  /**
   * If the input is a valid identifier, the URL path it should
   * resolve to. Callers can router.push(toHref) on submission.
   */
  toHref?: string;
}

const RE = {
  digits: /^\d+$/,
  hex64: /^[0-9a-f]{64}$/i,
  hexPrefix: /^[0-9a-f]+$/i,
  bech32Tidecoin: /^tbc1[0-9ac-hj-np-z]{6,87}$/,
  bech32Bitcoin: /^bc1[0-9ac-hj-np-z]{6,87}$/,
  base58T: /^T[1-9A-HJ-NP-Za-km-z]{25,40}$/,
  base58V: /^V[1-9A-HJ-NP-Za-km-z]{25,40}$/,
  base58F: /^F[1-9A-HJ-NP-Za-km-z]{25,40}$/,
  base58Bitcoin: /^[13][1-9A-HJ-NP-Za-km-z]{25,40}$/,
} as const;

export function classifyInput(raw: string): ClassifyInputResult {
  const input = raw.trim();

  if (input.length === 0) {
    return {
      kind: "unknown",
      valid: false,
      reason: "empty",
    };
  }

  // ---- block height --------------------------------------------------
  if (RE.digits.test(input)) {
    if (!Number.isSafeInteger(Number(input))) {
      return {
        kind: "block-height",
        valid: false,
        reason: "block height exceeds JavaScript's safe integer range",
      };
    }
    return {
      kind: "block-height",
      valid: true,
      reason: "looks like a block height",
      toHref: `/block/${input}`,
    };
  }

  // ---- 64-char hex: txid or block hash -----------------------------
  // We can't tell them apart without hitting the backend. The /block
  // route accepts either; the /tx route accepts only txids. Default
  // to treating it as a txid for classification, and let the pages
  // fall through to each other on a 404.
  if (RE.hex64.test(input)) {
    return {
      kind: "txid",
      valid: true,
      reason: "looks like a txid or block hash",
      toHref: `/tx/${input.toLowerCase()}`,
    };
  }

  // ---- partial txid / hash (user pasted a truncated one) ------
  if (RE.hexPrefix.test(input) && input.length >= 6 && input.length < 64) {
    return {
      kind: "partial-txid",
      valid: false,
      reason: `looks like a txid or block hash but is ${input.length} characters instead of 64`,
      hint:
        input.length === 63
          ? "you may be missing a character — double-check the copy"
          : `add ${64 - input.length} more characters`,
    };
  }

  // ---- bech32 native segwit (Tidecoin = tbc1...) ----------------
  if (RE.bech32Tidecoin.test(input)) {
    return {
      kind: "address-bech32",
      valid: true,
      reason: "Tidecoin native-segwit address",
      toHref: `/address/${input}`,
    };
  }

  if (RE.bech32Bitcoin.test(input)) {
    return {
      kind: "address-bech32",
      valid: false,
      reason: "this is a Bitcoin address, not Tidecoin",
      hint: "Tidecoin bech32 addresses start with tbc1, not bc1",
    };
  }

  // ---- Tidecoin base58 P2SH (T...) — the dominant form today ----
  if (RE.base58T.test(input)) {
    return {
      kind: "address-p2sh-T",
      valid: true,
      reason: "Tidecoin P2SH address (T-prefix, version byte 65)",
      toHref: `/address/${input}`,
    };
  }

  // ---- Tidecoin base58 P2SH (V...) primary prefix ----------------
  if (RE.base58V.test(input)) {
    return {
      kind: "address-p2sh-V",
      valid: true,
      reason: "Tidecoin P2SH address (V-prefix, version byte 70)",
      toHref: `/address/${input}`,
    };
  }

  // ---- Tidecoin base58 P2PKH (F...) ------------------------------
  if (RE.base58F.test(input)) {
    return {
      kind: "address-p2pkh-F",
      valid: true,
      reason: "Tidecoin P2PKH address (F-prefix, version byte 33)",
      toHref: `/address/${input}`,
    };
  }

  // ---- Bitcoin legacy address (near-miss) ----------------------------
  if (RE.base58Bitcoin.test(input)) {
    return {
      kind: "unknown",
      valid: false,
      reason: "this looks like a Bitcoin address, not Tidecoin",
      hint: "Tidecoin addresses start with T, F, V, or tbc1",
    };
  }

  return {
    kind: "unknown",
    valid: false,
    reason: "not a recognised block height, txid, or address",
    hint: "enter a block height, a 64-char lowercase hex txid, or an address starting with T, F, V, or tbc1",
  };
}
