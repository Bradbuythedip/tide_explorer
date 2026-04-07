import type { Config } from "tailwindcss";

/**
 * prevblock color discipline (DIRECTIVE.md §4.1, corrected per Phase 0
 * amendment #3).
 *
 * Design constraint: a green pixel means unambiguously "hash-protected
 * Falcon" and nothing else. Miners, nav highlights, and decorative
 * accents must not use any of the three threat-axis colors.
 *
 * Reserved for the quantum threat axis:
 *   emerald  hash-protected Falcon (the safe bucket)
 *   amber    pubkey-exposed Falcon
 *   rose     bare P2PK-Falcon + signal anomalies
 *
 * Brand:
 *   violet   single brand color; used in headings, links, CTAs
 *
 * Neutral:
 *   slate    text, borders, container backgrounds
 *
 * Miner palette (must never include green):
 *   blue, orange, fuchsia, amber(dark), sky — see `mining` below.
 *
 * Cyan is intentionally removed — the draft used it for ECDSA/Falcon
 * contrast and there is no ECDSA on Tidecoin.
 */
export default {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          DEFAULT: "#8b5cf6", // violet-500
          dim: "#7c3aed", // violet-600
          glow: "#a78bfa", // violet-400
        },
        // Quantum threat axis — RESERVED
        threat: {
          safe: "#10b981", // emerald-500 — hash-protected
          exposed: "#f59e0b", // amber-500 — pubkey-exposed
          bare: "#f43f5e", // rose-500 — bare P2PK / anomalies
        },
        // Neutral surfaces
        surface: {
          0: "#020617", // slate-950
          1: "#0f172a", // slate-900
          2: "#1e293b", // slate-800
          3: "#334155", // slate-700
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
  // Miner palette exposed as utility classes miner-1..miner-8 via
  // CSS variables in globals.css — kept out of theme.colors so nobody
  // accidentally imports them as `text-miner-3` and uses them for
  // non-miner things. See src/lib/miners.ts for the source of truth.
} satisfies Config;
