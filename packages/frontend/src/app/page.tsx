import Link from "next/link";
import { getRecentBlocks, getStatus } from "@/lib/api";
import { LiveKpis } from "@/components/LiveKpis";
import { RecentBlocks } from "@/components/RecentBlocks";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [status, recent] = await Promise.all([
    getStatus(),
    getRecentBlocks(15),
  ]);

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
            jump to the richlist, Tide Hold&apos;em, or the genesis block.
          </p>
        </div>
      </header>

      {status === null ? (
        <BackendDown />
      ) : (
        <LiveKpis
          initial={{
            tipHeight: status.chain.tipHeight,
            supplyTdc: status.supply.totalTdc,
            mempoolTxCount: status.mempool.txCount,
            peers: status.network.connections,
          }}
        />
      )}

      <section className="mt-10">
        {recent === null ? (
          <div className="rounded-lg border border-surface-3 bg-surface-1 p-6 text-sm text-slate-500">
            Recent blocks temporarily unavailable.
          </div>
        ) : (
          <RecentBlocks initial={recent} maxRows={15} />
        )}
      </section>

      <nav className="mt-12 flex flex-wrap gap-4 text-sm">
        <Link href="/genesis">Genesis</Link>
        <Link href="/holdem">Tide Hold&apos;em</Link>
        <Link href="/richlist">Richlist</Link>
        <Link href="/glossary">Glossary</Link>
        <Link href="/threat-model">Threat model</Link>
        <Link href="/tidoshi">Tidoshi</Link>
      </nav>
    </main>
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
