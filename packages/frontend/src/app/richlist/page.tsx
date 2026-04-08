import type { Metadata } from "next";
import Link from "next/link";
import { getRichlist, type RichlistEntry } from "@/lib/api";
import { DonutChart, type DonutSlice } from "@/components/DonutChart";
import { Term } from "@/components/Term";

export const metadata: Metadata = {
  title: "Tidecoin richlist",
  description:
    "Every Tidecoin address holding 1,000 TDC or more, with each balance broken down into the three-bucket Falcon partition: hash-protected, pubkey-exposed, and bare P2PK.",
};

export const dynamic = "force-dynamic";

const MIN_TDC = 1000;
const LIMIT = 5000;
const SATOSHIS_PER_COIN = 100_000_000n;

export default async function RichlistPage() {
  const data = await getRichlist(MIN_TDC, LIMIT);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-10">
        <p className="text-sm uppercase tracking-wider text-brand-glow">Richlist</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">
          Tidecoin addresses holding ≥ {MIN_TDC.toLocaleString()} TDC
        </h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Every address with at least {MIN_TDC.toLocaleString()} TDC unspent,
          ordered by balance. Each row shows how that whale&apos;s coins split
          across the three Falcon buckets — <Term name="hash-protected" />,{" "}
          <Term name="pubkey-exposed" />, and <Term name="bare-p2pk" />. The
          buckets are computed from the indexer&apos;s UTXO set, not estimated.
        </p>
      </header>

      {data === null ? (
        <DataUnavailable />
      ) : (
        <RichlistView data={data} />
      )}

      <p className="mt-12 text-sm">
        <Link href="/">← Dashboard</Link>
        <span className="mx-3 text-slate-600">·</span>
        <Link href="/quantum">Quantum risk</Link>
      </p>
    </main>
  );
}

function RichlistView({
  data,
}: {
  data: NonNullable<Awaited<ReturnType<typeof getRichlist>>>;
}) {
  const totalSats = BigInt(data.totalSats);
  const supplyTotalSats = BigInt(data.supplyTotalSats);
  const totalTdc = formatTdc(totalSats);
  const pctOfSupply = supplyTotalSats > 0n
    ? Number((totalSats * 10000n) / supplyTotalSats) / 100
    : 0;

  // Top-10 donut: aggregate the rest into "other whales"
  const top10 = data.entries.slice(0, 10);
  const restSats = data.entries
    .slice(10)
    .reduce((acc, e) => acc + BigInt(e.balanceSats), 0n);
  const slices: DonutSlice[] = [
    ...top10.map((e, i) => ({
      label: `#${e.rank} ${shortAddr(e.address)}`,
      value: Number(e.balanceSats),
      // Cycle through the brand+miner palette so colors are stable
      // and never collide with the threat axis (no green/amber/rose).
      color: PIE_PALETTE[i % PIE_PALETTE.length]!,
    })),
    {
      label: `${data.entries.length - top10.length} more whales`,
      value: Number(restSats),
      color: "#475569", // slate-600
    },
  ];

  return (
    <>
      <section className="mb-10 grid gap-6 lg:grid-cols-[auto_1fr]">
        <DonutChart
          slices={slices}
          ariaLabel={`Top 10 Tidecoin whales by balance, with the remaining ${data.entries.length - 10} whales aggregated`}
          size={260}
        >
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              richlist holds
            </div>
            <div className="mono mt-1 text-2xl font-semibold text-slate-100">
              {pctOfSupply.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500">of total supply</div>
          </div>
        </DonutChart>

        <div className="space-y-4">
          <Kpi
            label={`Addresses ≥ ${MIN_TDC} TDC`}
            value={data.totalAddresses.toLocaleString()}
          />
          <Kpi label="Combined balance" value={`${totalTdc} TDC`} />
          <Kpi
            label="As % of indexed supply"
            value={`${pctOfSupply.toFixed(2)}%`}
          />
          {data.entries.length < data.totalAddresses && (
            <p className="text-xs text-slate-500">
              Showing the top {data.entries.length.toLocaleString()} of{" "}
              {data.totalAddresses.toLocaleString()}. The donut aggregates the
              top 10 individually plus a slice for the remaining{" "}
              {data.entries.length - 10}.
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between text-xs text-slate-500">
          <span>
            Showing {data.entries.length.toLocaleString()} of{" "}
            {data.totalAddresses.toLocaleString()} addresses ≥{" "}
            {MIN_TDC.toLocaleString()} TDC
          </span>
          <span>ordered by balance, descending</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-surface-3">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="bg-surface-1">
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-3 pl-4 pr-4">#</th>
                <th className="py-3 pr-4">Address</th>
                <th className="py-3 pr-4 text-right">Balance (TDC)</th>
                <th className="py-3 pr-4 text-right">UTXOs</th>
                <th className="py-3 pr-4">Falcon partition</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <RichlistRow key={e.address} entry={e} />
              ))}
            </tbody>
          </table>
          {data.entries.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">
              No addresses meet the threshold yet. The indexer may still be
              catching up.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function RichlistRow({ entry }: { entry: RichlistEntry }) {
  const total = BigInt(entry.balanceSats);
  const hash = BigInt(entry.hashProtectedSats);
  const exposed = BigInt(entry.pubkeyExposedSats);
  const bare = BigInt(entry.bareP2pkSats);

  const pctHash = total > 0n ? Number((hash * 10000n) / total) / 100 : 0;
  const pctExposed = total > 0n ? Number((exposed * 10000n) / total) / 100 : 0;
  const pctBare = total > 0n ? Number((bare * 10000n) / total) / 100 : 0;

  return (
    <tr className="border-t border-surface-2/60 hover:bg-surface-1">
      <td className="py-3 pl-4 pr-4 text-slate-500">{entry.rank}</td>
      <td className="mono py-3 pr-4 text-slate-300">
        <Link href={`/address/${entry.address}`}>{shortAddr(entry.address)}</Link>
      </td>
      <td className="mono py-3 pr-4 text-right text-slate-100">
        {Number(entry.balanceTdc).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 8,
        })}
      </td>
      <td className="mono py-3 pr-4 text-right text-slate-400">{entry.utxoCount}</td>
      <td className="py-3 pr-4">
        <div
          className="flex h-2 overflow-hidden rounded-full bg-surface-3"
          aria-label={`hash-protected ${pctHash.toFixed(0)}%, pubkey-exposed ${pctExposed.toFixed(0)}%, bare ${pctBare.toFixed(0)}%`}
        >
          <div
            className="bg-threat-safe"
            style={{ width: `${pctHash}%` }}
            title={`Hash-protected ${pctHash.toFixed(1)}%`}
          />
          <div
            className="bg-threat-exposed"
            style={{ width: `${pctExposed}%` }}
            title={`Pubkey-exposed ${pctExposed.toFixed(1)}%`}
          />
          <div
            className="bg-threat-bare"
            style={{ width: `${pctBare}%` }}
            title={`Bare P2PK ${pctBare.toFixed(1)}%`}
          />
        </div>
      </td>
    </tr>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mono mt-1 text-xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function DataUnavailable() {
  return (
    <div className="rounded-lg border border-threat-bare/30 bg-threat-bare/5 p-6 text-sm text-slate-300">
      <p className="text-threat-bare">Richlist data not available yet.</p>
      <p className="mt-2 text-slate-400">
        Either the backend isn&apos;t running, the indexer isn&apos;t connected,
        or the indexer is still catching up. Check{" "}
        <span className="mono">/api/v1/quantum/supply</span> directly to confirm.
      </p>
    </div>
  );
}

function shortAddr(addr: string): string {
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function formatTdc(sats: bigint): string {
  const intPart = sats / SATOSHIS_PER_COIN;
  return Number(intPart).toLocaleString();
}

// Whale-distinguishing palette. Strict: no green/emerald/amber/rose
// (reserved for the Falcon threat axis), no cyan (DIRECTIVE.md §4.1
// removes it entirely now that there's no ECDSA/Falcon contrast to
// represent). Brand violet leads, then blues, indigos, pinks, oranges.
const PIE_PALETTE = [
  "#8b5cf6", // violet (brand)
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#a855f7", // purple
  "#ec4899", // pink
  "#f97316", // orange
  "#d946ef", // fuchsia
  "#a16207", // dark amber (NOT amber-500, which is reserved)
  "#0369a1", // sky-700
  "#7c3aed", // violet-600
];
