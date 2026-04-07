import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlock, type BlockTx, type BlockTxOut } from "@/lib/api";
import { Term } from "@/components/Term";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { idOrHeight: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  return {
    title: `Block ${params.idOrHeight}`,
    description: `Tidecoin block ${params.idOrHeight} — every output classified by prevblock's Falcon-aware script type detector.`,
  };
}

const SCRIPT_TYPE_COLOR: Record<string, string> = {
  p2pk_falcon: "text-threat-bare",
  p2pkh_falcon: "text-threat-safe",
  p2wpkh_falcon: "text-threat-safe",
  p2wsh_falcon: "text-threat-safe",
  p2sh: "text-threat-safe",
  op_return: "text-slate-500",
  witness_unknown: "text-slate-500",
  nonstandard: "text-slate-500",
};

export default async function BlockPage({ params }: PageProps) {
  const block = await getBlock(params.idOrHeight);
  if (block === null) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wider text-brand-glow">
          Block {block.height.toLocaleString()}
        </p>
        <h1 className="mono mt-2 break-all text-2xl font-semibold text-slate-100">
          {block.hash}
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          {new Date(block.time * 1000).toUTCString()} · {block.confirmations.toLocaleString()}{" "}
          confirmations
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Txs" value={block.txCount.toString()} />
        <Kpi label="Size" value={`${block.sizeBytes.toLocaleString()} B`} />
        <Kpi label="Weight" value={block.weight.toLocaleString()} />
        <Kpi label="Total out" value={`${block.totalOutTdc} TDC`} />
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Kpi
          label="Falcon-witness txs"
          value={`${block.falconTxCount} / ${block.txCount}`}
          tooltip="hash-protected"
        />
        <Kpi
          label="Bare-P2PK output txs"
          value={`${block.p2pkFalconTxCount} / ${block.txCount}`}
          tooltip="bare-p2pk"
        />
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          Navigate
        </h2>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {block.previousHash && (
            <Link href={`/block/${block.previousHash}`}>
              ← prev ({block.height - 1})
            </Link>
          )}
          {block.nextHash && (
            <Link href={`/block/${block.nextHash}`}>
              next ({block.height + 1}) →
            </Link>
          )}
          {block.height === 0 && (
            <Link href="/genesis">→ Full genesis story</Link>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xs uppercase tracking-wider text-slate-500">
          Transactions
        </h2>
        <div className="space-y-4">
          {block.txs.map((tx) => (
            <TxRow key={tx.txid} tx={tx} />
          ))}
        </div>
      </section>
    </main>
  );
}

function TxRow({ tx }: { tx: BlockTx }) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={`/tx/${tx.txid}`}
          className="mono break-all text-sm text-brand-glow"
        >
          {tx.txid}
        </Link>
        <div className="flex shrink-0 gap-2 text-xs">
          {tx.isCoinbase && (
            <span className="rounded bg-surface-2 px-2 py-0.5 text-slate-400">
              coinbase
            </span>
          )}
          {tx.hasFalconInput && (
            <span className="rounded bg-threat-safe/10 px-2 py-0.5 text-threat-safe">
              falcon witness
            </span>
          )}
          {tx.hasP2pkFalconOutput && (
            <span className="rounded bg-threat-bare/10 px-2 py-0.5 text-threat-bare">
              p2pk falcon out
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-1 text-xs text-slate-500">
        <div>
          {tx.vin.length} in · {tx.vout.length} out · {tx.vsize} vbytes ·{" "}
          {tx.totalOutTdc} TDC
        </div>
      </div>
      {tx.vout.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {tx.vout.slice(0, 6).map((out) => (
            <Vout key={out.n} out={out} />
          ))}
          {tx.vout.length > 6 && (
            <li className="text-slate-600">
              … and {tx.vout.length - 6} more outputs (
              <Link href={`/tx/${tx.txid}`}>view tx</Link>)
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function Vout({ out }: { out: BlockTxOut }) {
  const colorClass = SCRIPT_TYPE_COLOR[out.scriptType] ?? "text-slate-500";
  return (
    <li className="flex items-baseline justify-between gap-4">
      <span className="mono truncate text-slate-400">
        #{out.n}{" "}
        {out.address ? (
          <Link href={`/address/${out.address}`}>{out.address}</Link>
        ) : (
          <span className="text-slate-600">(no address)</span>
        )}
      </span>
      <span className="flex shrink-0 items-baseline gap-3">
        <span className={`mono text-[11px] uppercase ${colorClass}`}>
          {out.scriptType}
        </span>
        <span className="mono text-slate-300">{out.valueTdc}</span>
      </span>
    </li>
  );
}

function Kpi({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {tooltip ? <Term name={tooltip}>{label}</Term> : label}
      </div>
      <div className="mono mt-1 text-base font-semibold text-slate-100">{value}</div>
    </div>
  );
}
