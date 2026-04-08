import Link from "next/link";
import { getStatus } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const status = await getStatus();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <img
          src="/tidecoin-coin.svg"
          alt=""
          width={96}
          height={96}
          className="shrink-0"
        />
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-100">
            Tidecoin block explorer
          </h1>
          <p className="mt-3 max-w-2xl text-slate-400">
            Search a block height, txid, or address from the bar above. Or
            jump to the richlist, the quantum partition, or the genesis block.
          </p>
        </div>
      </header>

      {status === null ? (
        <BackendDown />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Tip height" value={status.chain.tipHeight.toLocaleString()} />
          <Kpi
            label="Supply (TDC)"
            value={Number(status.supply.totalTdc).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          />
          <Kpi label="Mempool txs" value={status.mempool.txCount.toString()} />
          <Kpi label="Peers" value={status.network.connections.toString()} />
        </div>
      )}

      <nav className="mt-12 flex flex-wrap gap-4 text-sm">
        <Link href="/genesis">Genesis</Link>
        <Link href="/quantum">Quantum risk</Link>
        <Link href="/richlist">Richlist</Link>
        <Link href="/glossary">Glossary</Link>
        <Link href="/threat-model">Threat model</Link>
      </nav>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mono mt-2 text-2xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function BackendDown() {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-6 text-sm text-slate-300">
      <p className="text-slate-200">Live chain data temporarily unavailable.</p>
      <p className="mt-2 text-slate-400">
        prevblock will show real-time KPIs here as soon as the connection to
        the Tidecoin node is restored.
      </p>
    </div>
  );
}
