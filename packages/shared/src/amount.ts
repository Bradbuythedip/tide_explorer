/**
 * Amount handling for Tidecoin.
 *
 * Source of truth: docs/source-extracts/amount.h
 *
 *   static const CAmount COIN = 100000000;
 *   static const CAmount MAX_MONEY = 21000000 * COIN;
 *
 * Tidecoin's JSON-RPC returns amounts as **decimal numbers in TDC** (e.g.
 * 0.62500000), not satoshis. JavaScript numbers are IEEE-754 floats and
 * cannot represent all satoshi values exactly beyond ~90 million TDC
 * (9e15 satoshi). We therefore parse every amount to a bigint of satoshis
 * at the RPC boundary and never let a float propagate into persistence,
 * aggregation, or display.
 */

/** 1 TDC in satoshis. */
export const SATOSHIS_PER_COIN = 100_000_000n;

/** Maximum money sanity cap (21,000,000 TDC in satoshis). */
export const MAX_MONEY_SATS = 21_000_000n * SATOSHIS_PER_COIN;

/**
 * Parse a decimal-TDC string (or number) from RPC into bigint satoshis.
 *
 * Accepts:
 *   "0.62500000", "50.00000000", 0, "0", 50, "1e-8"
 *
 * Rejects anything non-finite, negative, or larger than MAX_MONEY.
 *
 * We prefer the string form (tidecoin-cli always returns fixed-point
 * strings via JSON numbers, but some RPC client libs parse those as
 * floats; we accept both and normalize).
 */
export function parseTdcAmount(value: number | string): bigint {
  let s: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError(`non-finite TDC amount: ${value}`);
    }
    // Format with 8 decimals; this loses precision only if the float itself
    // was already lossy upstream (which is why callers should prefer strings).
    s = value.toFixed(8);
  } else {
    s = value.trim();
  }

  if (!/^-?\d+(\.\d+)?$/.test(s) && !/^-?\d+(\.\d+)?[eE]-?\d+$/.test(s)) {
    throw new SyntaxError(`not a decimal TDC amount: ${JSON.stringify(value)}`);
  }

  // Handle scientific notation by round-tripping through Number.toFixed.
  if (/[eE]/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) throw new RangeError(`non-finite TDC amount: ${s}`);
    s = n.toFixed(8);
  }

  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);

  const [intPart, fracPartRaw = ""] = s.split(".") as [string, string?];
  const fracPart = (fracPartRaw + "00000000").slice(0, 8);
  const sats = BigInt(intPart) * SATOSHIS_PER_COIN + BigInt(fracPart);
  const signed = negative ? -sats : sats;

  if (signed < 0n || signed > MAX_MONEY_SATS) {
    throw new RangeError(`TDC amount out of MoneyRange: ${s}`);
  }
  return signed;
}

/**
 * Format bigint satoshis as a decimal TDC string with exactly 8 decimals.
 * Use this for display, JSON-over-the-wire, and SQL inserts (as text).
 */
export function formatTdcAmount(sats: bigint): string {
  if (sats < 0n) return "-" + formatTdcAmount(-sats);
  const intPart = sats / SATOSHIS_PER_COIN;
  const fracPart = sats % SATOSHIS_PER_COIN;
  return `${intPart}.${fracPart.toString().padStart(8, "0")}`;
}
