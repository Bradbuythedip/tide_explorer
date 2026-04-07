/**
 * Mining-pool color palette.
 *
 * DIRECTIVE.md §4.1: miners never use green. A green pixel means
 * hash-protected Falcon, unambiguously. This palette is blues, oranges,
 * magentas, and a dark brown — eight distinct hues, no overlap with the
 * threat axis.
 *
 * The assignment of pool → color is deterministic via the string hash
 * so the same miner keeps the same color across pages and reloads.
 */

export const MINER_PALETTE = [
  "#3b82f6", // blue-500
  "#f97316", // orange-500
  "#d946ef", // fuchsia-500
  "#8b5cf6", // violet-500 — intentional overlap with brand; mining page
  //                           uses brand sparingly so collisions are rare
  "#0ea5e9", // sky-500
  "#ec4899", // pink-500
  "#a16207", // yellow-700 / dark amber
  "#6366f1", // indigo-500
] as const;

export function colorForMiner(tag: string | null | undefined): string {
  if (!tag) return "#64748b"; // slate-500 for "unknown"
  // tiny FNV-ish hash; deterministic, no crypto needed
  let h = 2166136261;
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % MINER_PALETTE.length;
  return MINER_PALETTE[idx]!;
}
