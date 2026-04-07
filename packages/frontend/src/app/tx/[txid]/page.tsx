import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTx, type TxDetail, type BlockTxIn, type BlockTxOut } from "@/lib/api";
import { Term } from "@/components/Term";
import { FALCON } from "@prevblock/shared";

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
    description: `Tidecoin transaction ${params.txid} — full input → output flow with prevblock's Falcon-aware classification on every output.`,
  };
}

const SCRIPT_TYPE_VARIANT: Record<
  string,
  { label: string; cls: string; term: string }
> = {
  p2pk_falcon: {
    label: "p2pk-falcon",
    cls: "text-threat-bare",
    term: "bare-p2pk",
  },
  p2pkh_falcon: {
    label: "p2pkh-falcon",
    cls: "text-threat-safe",
    term: "p2wpkh-falcon",
  },
  p2wpkh_falcon: {
    label: "p2wpkh-falcon",
    cls: "text-threat-safe",
    term: "p2wpkh-falcon",
  },
  p2wsh_falcon: {
    label: "p2wsh-falcon",
    cls: "text-threat-safe",
    term: "p2wpkh-falcon",
  },
  p2sh: { label: "p2sh", cls: "text-threat-safe", term: "p2sh" },
  op_return: { label: "op_return", cls: "text-slate-500", term: "p2sh" },
  witness_unknown: {
    label: "witness_unknown",
    cls: "text-slate-500",
    term: "p2sh",
  },
  nonstandard: { label: "nonstandard", cls: "text-slate-500", term: "p2sh" },
};

export default async function TxPage({ params, searchParams }: PageProps) {
  const tx = await getTx(params.txid, searchParams.blockhash);
  if (tx === null) notFound();

  const totalOut = BigInt(tx.totalOutSats);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider text-brand-glow">
          Transaction
        </p>
        <h1 className="mono mt-2 break-all text-xl font-semibold text-slate-100">
          {tx.txid}
        </h1>
        {tx.txid !== tx.wtxid && (
          <p className="mt-1 text-xs text-slate-500">
            wtxid <span className="mono">{tx.wtxid}</span>
          </p>
        )}
      </header>

      <TxBadges tx={tx} />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Status"
          value={
            tx.confirmations === null
              ? "mempool"
              : `${tx.confirmations.toLocaleString()} conf`
          }
        />
        <Kpi label="Size" value={`${tx.size} B`} />
        <Kpi label="vSize" value={`${tx.vsize} vB`} />
        <Kpi label="Weight" value={tx.weight.toLocaleString()} />
        <Kpi label="Total out" value={`${tx.totalOutTdc} TDC`} />
      </section>

      {tx.blockhash !== null && (
        <p className="mt-6 text-sm text-slate-400">
          In block{" "}
          <Link href={`/block/${tx.blockhash}`} className="mono break-all">
            {tx.blockhash}
          </Link>
          {tx.time !== null && (
            <span className="ml-2 text-slate-500">
              · {new Date(tx.time * 1000).toUTCString()}
            </span>
          )}
        </p>
      )}

      {/* The mempool-style flow layout: inputs on the left, an arrow,
          outputs on the right. Stacks on mobile. */}
      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <div>
          <SectionTitle>
            Inputs <span className="text-slate-500">({tx.vin.length})</span>
          </SectionTitle>
          <div className="mt-3 space-y-3">
            {tx.vin.map((vin, idx) => (
              <InputCard key={idx} vin={vin} index={idx} />
            ))}
          </div>
        </div>

        <FlowArrow />

        <div>
          <SectionTitle>
            Outputs <span className="text-slate-500">({tx.vout.length})</span>
          </SectionTitle>
          <div className="mt-3 space-y-3">
            {tx.vout.map((out) => (
              <OutputCard key={out.n} out={out} totalOut={totalOut} />
            ))}
          </div>
        </div>
      </section>

      {/* Witness deep-dive section: only renders when at least one input
          carries a witness, which on Tidecoin is the rule for any
          non-coinbase tx. */}
      {tx.vin.some((v) => v.witness !== null && v.witness.itemCount > 0) && (
        <section className="mt-12">
          <SectionTitle>Witness deep-dive</SectionTitle>
          <p className="mt-2 text-sm text-slate-400">
            Each non-coinbase input on Tidecoin carries a Falcon-512 signature
            and the corresponding 898-byte public key. prevblock checks the
            byte lengths against{" "}
            <span className="mono">FALCON.SIGNATURE_SIZE = {FALCON.SIGNATURE_SIZE}</span>{" "}
            and{" "}
            <span className="mono">FALCON.PUBLIC_KEY_SIZE = {FALCON.PUBLIC_KEY_SIZE}</span>{" "}
            (from <span className="mono">key.h:17-19</span>) and flags
            anything that matches.
          </p>
          <div className="mt-4 space-y-4">
            {tx.vin.map((vin, idx) =>
              vin.witness && vin.witness.itemCount > 0 ? (
                <WitnessCard key={idx} index={idx} witness={vin.witness} />
              ) : null,
            )}
          </div>
        </section>
      )}

      <section className="mt-12 text-sm">
        <Link href={tx.blockhash ? `/block/${tx.blockhash}` : "/"}>
          ← {tx.blockhash ? "Block" : "Dashboard"}
        </Link>
      </section>
    </main>
  );
}

function TxBadges({ tx }: { tx: TxDetail }) {
  const badges: { label: string; cls: string }[] = [];
  if (tx.isCoinbase) {
    badges.push({
      label: "coinbase",
      cls: "bg-surface-2 text-slate-300",
    });
  }
  if (tx.hasFalconInput) {
    badges.push({
      label: "falcon witness",
      cls: "bg-threat-safe/10 text-threat-safe",
    });
  }
  if (tx.hasP2pkFalconOutput) {
    badges.push({
      label: "p2pk-falcon out",
      cls: "bg-threat-bare/10 text-threat-bare",
    });
  }
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <span
          key={b.label}
          className={`rounded px-3 py-1 text-xs font-medium uppercase tracking-wider ${b.cls}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs uppercase tracking-wider text-slate-500">
      {children}
    </h2>
  );
}

function FlowArrow() {
  return (
    <div className="hidden items-center justify-center lg:flex">
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </div>
  );
}

function InputCard({ vin, index }: { vin: BlockTxIn; index: number }) {
  if (vin.isCoinbase) {
    return (
      <div className="rounded-lg border border-surface-3 bg-surface-1 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wider text-slate-500">
            #{index} coinbase
          </span>
          <span className="rounded bg-surface-2 px-2 py-0.5 text-[10px] text-slate-400">
            new coins
          </span>
        </div>
        <div className="mono mt-2 break-all text-xs text-slate-400">
          {vin.coinbaseHex}
        </div>
        {tryDecodeAscii(vin.coinbaseHex ?? "") && (
          <div className="mt-2 text-xs text-slate-500">
            ASCII fragment:{" "}
            <span className="mono text-slate-300">
              {tryDecodeAscii(vin.coinbaseHex ?? "")}
            </span>
          </div>
        )}
      </div>
    );
  }

  const isFalcon = vin.witness?.looksLikeFalconP2wpkh ?? false;

  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">
          #{index}
        </span>
        {isFalcon && (
          <span className="rounded bg-threat-safe/10 px-2 py-0.5 text-[10px] text-threat-safe">
            falcon
          </span>
        )}
      </div>
      <div className="mt-2 text-xs">
        <div className="text-slate-500">spends</div>
        <div className="mono mt-1 break-all">
          <Link href={`/tx/${vin.prevTxid}`}>{vin.prevTxid}</Link>
          <span className="text-slate-500">:{vin.prevVout}</span>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
        sequence{" "}
        <span className="mono text-slate-400">
          {(vin.sequence >>> 0).toString(16).padStart(8, "0")}
        </span>
        {vin.sequence < 0xfffffffe && (
          <span className="ml-2 text-threat-exposed">RBF</span>
        )}
      </div>
    </div>
  );
}

function OutputCard({
  out,
  totalOut,
}: {
  out: BlockTxOut;
  totalOut: bigint;
}) {
  const variant =
    SCRIPT_TYPE_VARIANT[out.scriptType] ?? SCRIPT_TYPE_VARIANT.nonstandard!;
  const valueSats = BigInt(out.valueSats);
  const pctOfTx =
    totalOut > 0n
      ? (Number((valueSats * 10000n) / totalOut) / 100).toFixed(1)
      : "0.0";
  const showRelabel = out.nodeType !== out.scriptType;

  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs uppercase tracking-wider text-slate-500">
          #{out.n}
        </span>
        <span className="mono shrink-0 text-sm font-semibold text-slate-100">
          {out.valueTdc} TDC
        </span>
      </div>
      <div className="mt-2 text-xs">
        <div className="text-slate-500">to</div>
        <div className="mono mt-1 break-all">
          {out.address ? (
            <Link href={`/address/${out.address}`}>{out.address}</Link>
          ) : (
            <span className="text-slate-600">
              {out.scriptType === "op_return" ? "OP_RETURN data" : "no address"}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-2 text-[11px]">
        <Term name={variant.term}>
          <span className={`mono uppercase ${variant.cls}`}>
            {variant.label}
          </span>
        </Term>
        {showRelabel && (
          <span className="text-slate-600">
            (node calls it{" "}
            <span className="mono">{out.nodeType}</span>)
          </span>
        )}
        <span className="text-slate-500">·</span>
        <span className="text-slate-500">{pctOfTx}% of tx</span>
      </div>
      {out.pubkey && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
            Falcon public key ({out.pubkey.length / 2} bytes)
          </summary>
          <pre className="mono mt-2 max-h-40 overflow-auto rounded bg-surface-2 p-2 text-[10px] text-slate-400">
            {out.pubkey}
          </pre>
        </details>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
          scriptPubKey hex
        </summary>
        <pre className="mono mt-2 max-h-40 overflow-auto rounded bg-surface-2 p-2 text-[10px] text-slate-400">
          {out.scriptPubKeyHex}
        </pre>
      </details>
    </div>
  );
}

function WitnessCard({
  index,
  witness,
}: {
  index: number;
  witness: NonNullable<BlockTxIn["witness"]>;
}) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          Input #{index} witness
        </h3>
        {witness.looksLikeFalconP2wpkh && (
          <span className="rounded bg-threat-safe/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-threat-safe">
            falcon p2wpkh shape
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {witness.itemCount} stack item{witness.itemCount === 1 ? "" : "s"}
      </p>
      <div className="mt-3 space-y-3">
        {witness.items.map((item) => {
          const role = identifyWitnessItem(item.lengthBytes);
          return (
            <div key={item.index} className="rounded border border-surface-2 p-2">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-500">[{item.index}]</span>
                <span className="mono text-slate-400">
                  {item.lengthBytes} bytes
                </span>
              </div>
              {role && (
                <div className="mt-1 text-[11px] text-threat-safe">{role}</div>
              )}
              <pre className="mono mt-2 max-h-32 overflow-auto rounded bg-surface-2 p-2 text-[10px] text-slate-500">
                {item.hex}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function identifyWitnessItem(lengthBytes: number): string | null {
  if (lengthBytes === FALCON.SIGNATURE_SIZE) {
    return `Falcon-512 signature (matches FALCON.SIGNATURE_SIZE = ${FALCON.SIGNATURE_SIZE})`;
  }
  if (lengthBytes === FALCON.PUBLIC_KEY_SIZE) {
    return `Falcon-512 public key (matches FALCON.PUBLIC_KEY_SIZE = ${FALCON.PUBLIC_KEY_SIZE})`;
  }
  return null;
}

function tryDecodeAscii(hex: string): string | null {
  if (!hex) return null;
  try {
    let out = "";
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.substr(i, 2), 16);
      if (byte >= 0x20 && byte <= 0x7e) out += String.fromCharCode(byte);
      else out += " ";
    }
    // Pull the longest printable run >= 8 chars; null otherwise
    const runs = out.match(/[\x20-\x7e]{8,}/g);
    if (!runs || runs.length === 0) return null;
    return runs.sort((a, b) => b.length - a.length)[0]!.trim();
  } catch {
    return null;
  }
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mono mt-1 text-base font-semibold text-slate-100">
        {value}
      </div>
    </div>
  );
}
