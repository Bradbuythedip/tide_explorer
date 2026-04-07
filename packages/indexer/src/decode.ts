/**
 * Small pure decoders used by the sync loop.
 *
 * Everything in this file is deterministic, dependency-free, and has
 * no I/O. Tested against the real bytes in docs/sample-responses/.
 */

import { FALCON } from "@prevblock/shared";

// ---- hex ------------------------------------------------------------------

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex string has odd length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

// ---- miner tag detection --------------------------------------------------

/**
 * Given a coinbase scriptSig hex, extract a best-effort miner tag.
 *
 * Heuristics, in priority order:
 *   1. Ascii-printable substring containing a domain-looking token
 *      (matches `rplant.xyz`, `pool.xxx`, etc. — the tag observed in
 *      docs/sample-responses/21-tip-block.json).
 *   2. Ascii-printable substring >= 6 chars following a `/` separator
 *      (classic pool vanity strings a la `/Mined by Antpool/`).
 *   3. Null.
 *
 * Returning null is fine — the DB column is nullable.
 */
export function extractMinerTag(coinbaseHex: string): string | null {
  const bytes = hexToBytes(coinbaseHex);
  const text = asciiRuns(bytes, 4);
  if (text.length === 0) return null;

  // Rule 1: domain-looking tokens
  for (const run of text) {
    const m = run.match(/[a-z0-9][a-z0-9.-]{3,}\.(?:xyz|org|com|io|net|co|dev|me|sh|info|pro|space)/i);
    if (m) return m[0];
  }

  // Rule 2: slash-delimited vanity
  for (const run of text) {
    const m = run.match(/\/([^/]{6,})\//);
    if (m && m[1]) return m[1].trim();
  }

  // Rule 3: fall back to longest run if it looks tag-ish
  const longest = text.sort((a, b) => b.length - a.length)[0]!;
  if (longest.length >= 6 && /[a-zA-Z]/.test(longest)) return longest;

  return null;
}

/** Extract runs of printable ASCII from a byte buffer, each at least `min` long. */
function asciiRuns(bytes: Uint8Array, min: number): string[] {
  const runs: string[] = [];
  let current = "";
  for (const b of bytes) {
    if (b >= 0x20 && b <= 0x7e) {
      current += String.fromCharCode(b);
    } else {
      if (current.length >= min) runs.push(current);
      current = "";
    }
  }
  if (current.length >= min) runs.push(current);
  return runs;
}

// ---- Falcon witness detection --------------------------------------------

/**
 * True iff the witness stack looks exactly like a Tidecoin P2WPKH-Falcon
 * spend: two items, first == 690 bytes (Falcon sig), second == 898 bytes
 * (Falcon pubkey).
 *
 * This matches the observed witness in docs/sample-responses/70-big.json
 * exactly.
 */
export function witnessLooksLikeFalconP2wpkh(witnessHexStack: string[]): boolean {
  if (witnessHexStack.length !== 2) return false;
  const sigItem = witnessHexStack[0]!;
  const pkItem = witnessHexStack[1]!;
  return (
    sigItem.length / 2 === FALCON.SIGNATURE_SIZE &&
    pkItem.length / 2 === FALCON.PUBLIC_KEY_SIZE
  );
}

/**
 * Return the Falcon pubkey bytes from a witness stack, if the witness
 * is shaped like a Falcon P2WPKH spend. Otherwise null.
 *
 * Used by the sync loop to record the "this address's pubkey is now
 * on-chain" event: when a hash-protected output is spent, the
 * spending input's witness reveals the pubkey, and we propagate that
 * to `outputs.pubkey_revealed_at_height` for every output bound to
 * the same address.
 */
export function extractFalconPubkey(witnessHexStack: string[]): Uint8Array | null {
  if (!witnessLooksLikeFalconP2wpkh(witnessHexStack)) return null;
  return hexToBytes(witnessHexStack[1]!);
}

// ---- OP_RETURN payload --------------------------------------------------

/**
 * Strip the leading OP_RETURN opcode and any push-data length prefix
 * from a scriptPubKey to yield the attestation payload bytes.
 *
 * Tidecoin coinbase witness-commitment outputs have scriptPubKey:
 *   6a 24 aa21a9ed <32-byte witness root>
 *   └  └  └─magic─
 *   op_return
 *      push 36 bytes
 * We return the 36 bytes after the push opcode.
 */
export function decodeOpReturnPayload(scriptPubKeyHex: string): Uint8Array | null {
  const bytes = hexToBytes(scriptPubKeyHex);
  if (bytes.length < 1 || bytes[0] !== 0x6a) return null;
  let i = 1;
  let len = 0;
  if (i >= bytes.length) return new Uint8Array();
  const op = bytes[i++]!;
  if (op >= 0x01 && op <= 0x4b) {
    len = op;
  } else if (op === 0x4c) {
    if (i >= bytes.length) return null;
    len = bytes[i++]!;
  } else if (op === 0x4d) {
    if (i + 1 >= bytes.length) return null;
    len = bytes[i]! | (bytes[i + 1]! << 8);
    i += 2;
  } else {
    return new Uint8Array();
  }
  if (i + len > bytes.length) return null;
  return bytes.slice(i, i + len);
}

// ---- witness-commitment detection ---------------------------------------

/**
 * True iff the OP_RETURN payload starts with the BIP141 witness
 * commitment magic `aa21a9ed`. These are not user OP_RETURNs and
 * should be excluded from attestation listings.
 */
export function isWitnessCommitment(payload: Uint8Array): boolean {
  return (
    payload.length >= 4 &&
    payload[0] === 0xaa &&
    payload[1] === 0x21 &&
    payload[2] === 0xa9 &&
    payload[3] === 0xed
  );
}
