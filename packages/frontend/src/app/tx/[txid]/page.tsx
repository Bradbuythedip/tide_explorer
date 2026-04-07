import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTx, type TxDetail } from "@/lib/api";
import { Term } from "@/components/Term";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { txid: string };
  searchParams: { blockhash?: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  return {
    title: `tx ${params.txid.slice(0, 12)}…`,
    description: `Tidecoin transaction ${params.txid} — every output classified by prevblock's Falcon-aware classifier.`,
  };
}

const SCRIPT_TYPE_LABEL: Record<string, string> = {
  p2pk_falcon: "p2pk-falcon",
  p2pkh_falcon: "p2wpkh-falcon",
  p2wpkh_falcon: "p2wpkh-falcon",
  p2wsh_falcon: "p2wpkh-falcon",
  p2sh: "p2sh",
};

export default async function TxPage({ params, searchParams }: PageProps) {
  const tx = await getTx(params.txid, searchParams.blockhash);
  if (tx === null) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wider text-brand-glow">Transaction</p>
        <h1 className="mono mt-2 break-all text-2xl font-semibold text-slate-100">
          {tx.txid}
        </h1>
        {tx.txid !== tx.wtxid && (
          <p className="mt-1 text-xs text-slate-500">
            wtxid <span className="mono">{tx.wtxid}</span>
          </p>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Status" value={tx.confirmations === null ? "mempool" : `${tx.confirmations.toLocaleString()} conf`} />
        <Kpi label="Size" value={`${tx.size} B`} />
        <Kpi label="vSize" value={`${tx.vsize} vB`} />
        <Kpi label="Total out" value={`${tx.totalOutTdc} TDC`} />
      </section>

      {(tx.hasFalconInput || tx.hasP2pkFalconOutput) && (
        <section className="mt-6 flex flex-wrap gap-2">
          {tx.hasFalconInput && (
            <span className="rounded bg-threat-safe/10 px-3 py-1 text-xs text-threat-safe">
              Falcon witness present (this tx revealed a Falcon pubkey on chain)
            </span>
          )}
          {tx.hasP2pkFalconOutput && (
            <span className="rounded bg-threat-bare/10 px-3 py-1 text-xs text-threat-bare">
              Bare P2PK-Falcon output (the upstream Solver blind spot)
            </span>
          )}
        </section>
      )}

      {tx.blockhash !== null && (
        <p className="mt-6 text-sm">
          In block <Link href={`/block/${tx.blockhash}`} className="mono">{tx.blockhash}</Link>
          {tx.time !== null && (
            <> · {new Date(tx.time * 1000).toUTCString()}</>
          )}
        </p>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-slate-500">
          Inputs ({tx.vin.length})
        </h2>
        <div className="space-y-2">
          {tx.vin.map((vin, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-surface-3 bg-surface-1 p-3 text-sm"
            >
              {vin.isCoinbase ? (
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">
                    coinbase
                  </div>
                  <div className="mono mt-1 break-all text-xs text-slate-400">
                    {vin.coinbaseHex}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mono break-all">
                    <Link href={`/tx/${vin.prevTxid}`}>{vin.prevTxid}</Link>
                    <span className="text-slate-500">:{vin.prevVout}</span>
                  </div>
                  {vin.witness && (
                    <div className="mt-2 text-xs">
                      <div className="text-slate-500">
                        witness ({vin.witness.itemCount} items
                        {vin.witness.looksLikeFalconP2wpkh && (
                          <>
                            ,{" "}
                            <span className="text-threat-safe">
                              Falcon P2WPKH shape
                            </span>
                          </>
                        )}
                        )
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {vin.witness.items.map((item) => (
                          <li key={item.index} className="mono text-slate-500">
                            [{item.index}] {item.lengthBytes} bytes ·{" "}
                            <span className="text-slate-600">
                              {item.hex.slice(0, 32)}…
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-slate-500">
          Outputs ({tx.vout.length})
        </h2>
        <div className="space-y-2">
          {tx.vout.map((out) => {
            const corrected = SCRIPT_TYPE_LABEL[out.scriptType];
            const showRelabel = out.nodeType !== out.scriptType;
            return (
              <div
                key={out.n}
                className="rounded-lg border border-surface-3 bg-surface-1 p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="mono break-all">
                    #{out.n}{" "}
                    {out.address ? (
                      <Link href={`/address/${out.address}`}>{out.address}</Link>
                    ) : (
                      <span className="text-slate-600">(no address)</span>
                    )}
                  </div>
                  <div className="mono shrink-0 text-slate-100">{out.valueTdc} TDC</div>
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-3 text-xs">
                  <span className="text-slate-500">prevblock:</span>
                  <Term name={corrected ?? "bare-p2pk"}>
                    <span className="mono text-threat-bare">{out.scriptType}</span>
                  </Term>
                  {showRelabel && (
                    <>
                      <span className="text-slate-500">node:</span>
                      <span className="mono text-slate-600">{out.nodeType}</span>
                    </>
                  )}
                </div>
                {out.pubkey && (
                  <div className="mt-2 text-xs text-slate-500">
                    Falcon pubkey:{" "}
                    <span className="mono break-all text-slate-400">
                      {out.pubkey.slice(0, 32)}…{out.pubkey.slice(-16)}{" "}
                      <span className="text-slate-600">
                        ({out.pubkey.length / 2} bytes)
                      </span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mono mt-1 text-base font-semibold text-slate-100">{value}</div>
    </div>
  );
}
