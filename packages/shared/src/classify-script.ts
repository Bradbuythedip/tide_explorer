/**
 * Script-type classifier.
 *
 * Why this exists: Tidecoin's upstream Bitcoin Core 0.18.3 `Solver()`
 * has a blind spot for bare-Falcon P2PK outputs (see
 * docs/tidecoin-protocol.md §3.1 — `MatchPayToPubkey` requires the push
 * length to fit in a single byte, but a 898-byte Falcon pubkey cannot).
 * Every `p2pk_falcon` output on the chain — including the genesis
 * coinbase — is therefore reported as `"type": "nonstandard"` by the
 * node. Our classifier recognises the shape directly from the raw
 * scriptPubKey hex and emits the correct label.
 *
 * This function must be pure and side-effect-free. It is called from
 * the backend (for per-tx reads) and from the indexer (for every
 * output in every block), so it's on the hot path.
 */

import { FALCON, type ScriptType } from "./script-types.js";

export interface ClassifyResult {
  type: ScriptType;
  /** For hash-programmed outputs, the 20- or 32-byte program in hex. */
  hash?: string;
  /** For p2pk_falcon, the raw 898-byte pubkey in hex. */
  pubkey?: string;
  /** For witness outputs, the witness version. 0 is the only observed value. */
  witnessVersion?: number;
}

// Opcode constants used by the classifier. Keeping a tiny local copy is
// clearer than importing a bitcoin library.
const OP_0 = 0x00;
const OP_PUSHDATA2 = 0x4d;
const OP_RETURN = 0x6a;
const OP_DUP = 0x76;
const OP_EQUAL = 0x87;
const OP_EQUALVERIFY = 0x88;
const OP_HASH160 = 0xa9;
const OP_CHECKSIG = 0xac;

/**
 * Classify a scriptPubKey from its raw hex bytes.
 *
 * Recognised shapes (in check order):
 *   1. P2SH:             OP_HASH160 0x14 <20B> OP_EQUAL                       (23 bytes)
 *   2. P2PKH-Falcon:     OP_DUP OP_HASH160 0x14 <20B> OP_EQUALVERIFY OP_CHECKSIG (25 bytes)
 *   3. P2WPKH-Falcon:    OP_0 0x14 <20B>                                      (22 bytes)
 *   4. P2WSH-Falcon:     OP_0 0x20 <32B>                                      (34 bytes)
 *   5. witness_unknown:  <v1..v16> <push 2..40 B>
 *   6. OP_RETURN:        OP_RETURN <push-only*>                               (any length)
 *   7. P2PK-Falcon:      OP_PUSHDATA2 0x82 0x03 <898B> OP_CHECKSIG             (902 bytes)
 *      (This is the case Tidecoin's own Solver() can't see.)
 *   8. nonstandard:      everything else
 */
export function classifyScriptPubKey(hexScript: string): ClassifyResult {
  const script = hexToBytes(hexScript);
  const len = script.length;

  // 1. P2SH
  if (
    len === 23 &&
    script[0] === OP_HASH160 &&
    script[1] === 0x14 &&
    script[22] === OP_EQUAL
  ) {
    return { type: "p2sh", hash: bytesToHex(script.subarray(2, 22)) };
  }

  // 2. P2PKH-Falcon
  if (
    len === 25 &&
    script[0] === OP_DUP &&
    script[1] === OP_HASH160 &&
    script[2] === 0x14 &&
    script[23] === OP_EQUALVERIFY &&
    script[24] === OP_CHECKSIG
  ) {
    return { type: "p2pkh_falcon", hash: bytesToHex(script.subarray(3, 23)) };
  }

  // 3 + 4. Native witness v0 (P2WPKH-Falcon, P2WSH-Falcon)
  if (len === 22 && script[0] === OP_0 && script[1] === 0x14) {
    return {
      type: "p2wpkh_falcon",
      hash: bytesToHex(script.subarray(2, 22)),
      witnessVersion: 0,
    };
  }
  if (len === 34 && script[0] === OP_0 && script[1] === 0x20) {
    return {
      type: "p2wsh_falcon",
      hash: bytesToHex(script.subarray(2, 34)),
      witnessVersion: 0,
    };
  }

  // 5. witness_unknown (v1..v16, program length 2..40). This is the same
  // rule upstream's IsWitnessProgram() uses.
  if (len >= 4 && len <= 42) {
    const firstOp = script[0]!;
    const secondOp = script[1]!;
    const isVerOp =
      firstOp === 0x51 || // OP_1
      (firstOp >= 0x52 && firstOp <= 0x60); // OP_2..OP_16
    if (isVerOp && secondOp + 2 === len && secondOp >= 2 && secondOp <= 40) {
      return { type: "witness_unknown", witnessVersion: firstOp - 0x50 };
    }
  }

  // 6. OP_RETURN (any trailing bytes)
  if (len >= 1 && script[0] === OP_RETURN) {
    return { type: "op_return" };
  }

  // 7. Bare P2PK-Falcon — the upstream blind spot.
  //    0x4d (OP_PUSHDATA2) 0x82 0x03 <898 bytes> 0xac (OP_CHECKSIG)
  //    Total: 1 + 2 + 898 + 1 = 902 bytes.
  if (
    len === 902 &&
    script[0] === OP_PUSHDATA2 &&
    script[1] === 0x82 &&
    script[2] === 0x03 &&
    script[901] === OP_CHECKSIG
  ) {
    const pubkey = bytesToHex(script.subarray(3, 3 + FALCON.PUBLIC_KEY_SIZE));
    return { type: "p2pk_falcon", pubkey };
  }

  return { type: "nonstandard" };
}

// ---- tiny hex helpers to keep this module dependency-free ----

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex string has odd length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) throw new Error("invalid hex");
    out[i] = byte;
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}
