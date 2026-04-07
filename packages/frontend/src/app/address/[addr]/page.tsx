import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAddress, type AddressSummary } from "@/lib/api";
import { DonutChart, type DonutSlice } from "@/components/DonutChart";
import { Term } from "@/components/Term";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { addr: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  return {
    title: `Address ${params.addr.slice(0, 12)}…`,
    description: `Tidecoin address ${params.addr} — balance, UTXOs, and the three-bucket Falcon partition for this address's coins.`,
  };
}

export default async function AddressPage({ params }: PageProps) {
  const data = await getAddress(params.addr);
  if (data === null) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wider text-brand-glow">Address</p>
        <h1 className="mono mt-2 break-all text-2xl font-semibold text-slate-100">
          {data.address}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {data.utxoCount.toLocaleString()} UTXO{data.utxoCount === 1 ? "" : "s"} ·{" "}
          {Number(data.balanceTdc).toLocaleString(undefined, {
            maximumFractionDigits: 8,
          })}{" "}
          TDC
        </p>
      </header>

      <Partition data={data} />

      <section className="mt-10">
        <h2 className="mb-4 text-xs uppercase tracking-wider text-slate-500">
          Unspent outputs
          {data.utxos.length < data.utxoCount && (
            <span className="ml-2 normal-case text-slate-600">
              showing {data.utxos.length} of {data.utxoCount.toLocaleString()}
            </span>
          )}
        </h2>
        {data.utxos.length === 0 ? (
          <p className="text-sm text-slate-500">No unspent outputs.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface-3 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-3 pr-4">Tx</th>
                <th className="py-3 pr-4 text-right">Value (TDC)</th>
                <th className="py-3 pr-4">Type</th>
                <th className="py-3 pr-4">Pubkey state</th>
              </tr>
            </thead>
            <tbody>
              {data.utxos.map((u) => (
                <tr
                  key={`${u.txid}:${u.vout}`}
                  className="border-b border-surface-2/60 hover:bg-surface-1"
                >
                  <td className="mono py-3 pr-4">
                    <Link href={`/tx/${u.txid}`}>
                      {u.txid.slice(0, 12)}…
                    </Link>
                    <span className="text-slate-600">:{u.vout}</span>
                  </td>
                  <td className="mono py-3 pr-4 text-right text-slate-100">
                    {Number(u.valueTdc).toLocaleString(undefined, {
                      maximumFractionDigits: 8,
                    })}
                  </td>
                  <td className="mono py-3 pr-4 text-xs uppercase">
                    {u.scriptType}
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {u.pubkeyRevealedAtHeight === null ? (
                      <span className="text-threat-safe">hidden</span>
                    ) : (
                      <span className="text-threat-exposed">
                        revealed at height {u.pubkeyRevealedAtHeight.toLocaleString()}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function Partition({ data }: { data: AddressSummary }) {
  const hash = BigInt(data.partition.hashProtectedSats);
  const exposed = BigInt(data.partition.pubkeyExposedSats);
  const bare = BigInt(data.partition.bareP2pkSats);
  const total = BigInt(data.balanceSats);

  const pct = (n: bigint) =>
    total > 0n ? (Number((n * 10000n) / total) / 100).toFixed(1) : "0.0";

  const slices: DonutSlice[] = [
    { label: "Hash-protected", value: Number(hash), color: "#10b981" },
    { label: "Pubkey-exposed", value: Number(exposed), color: "#f59e0b" },
    { label: "Bare P2PK", value: Number(bare), color: "#f43f5e" },
  ];

  return (
    <section className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <DonutChart
        slices={slices}
        ariaLabel="Three-bucket Falcon partition for this address"
        size={200}
      >
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            balance
          </div>
          <div className="mono mt-1 text-lg font-semibold text-slate-100">
            {Number(data.balanceTdc).toFixed(2)}
          </div>
          <div className="text-xs text-slate-500">TDC</div>
        </div>
      </DonutChart>

      <div className="space-y-2 text-sm">
        <Bucket
          color="#10b981"
          label="hash-protected"
          term="hash-protected"
          tdc={data.partition.hashProtectedTdc}
          pct={pct(hash)}
        />
        <Bucket
          color="#f59e0b"
          label="pubkey-exposed"
          term="pubkey-exposed"
          tdc={data.partition.pubkeyExposedTdc}
          pct={pct(exposed)}
        />
        <Bucket
          color="#f43f5e"
          label="bare P2PK"
          term="bare-p2pk"
          tdc={data.partition.bareP2pkTdc}
          pct={pct(bare)}
        />
        {data.pubkeyEverRevealed && (
          <p className="mt-3 text-xs text-slate-500">
            Note: this address&apos;s Falcon public key has appeared on chain at
            least once. Subsequent UTXOs received here count as{" "}
            <Term name="pubkey-exposed" /> until you consolidate them into a
            fresh hash-protected output.
          </p>
        )}
      </div>
    </section>
  );
}

function Bucket({
  color,
  label,
  term,
  tdc,
  pct,
}: {
  color: string;
  label: string;
  term: string;
  tdc: string;
  pct: string;
}) {
  return (
    <div className="flex items-center justify-between rounded border border-surface-3 bg-surface-1 px-3 py-2">
      <span className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <Term name={term}>{label}</Term>
      </span>
      <span className="mono text-slate-300">
        {pct}% · {Number(tdc).toLocaleString(undefined, { maximumFractionDigits: 2 })} TDC
      </span>
    </div>
  );
}
