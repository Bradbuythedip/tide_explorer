import type { Metadata } from "next";
import Link from "next/link";
import { getBlock } from "@/lib/api";

export const metadata: Metadata = {
  title: "Genesis block",
  description:
    "Tidecoin's genesis block — mined December 27, 2020. Contains an IEEE Spectrum headline from December 9, 2020 about photonic quantum computing supremacy.",
};

export const dynamic = "force-dynamic";

const GENESIS_HASH =
  "480ecc7602d8989f32483377ed66381c391dda6215aeef9e80486a7fd3018075";

export default async function GenesisPage() {
  const block = await getBlock("0");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <img
          src="/tidecoin-coin.svg"
          alt=""
          width={96}
          height={96}
          className="shrink-0"
        />
        <div>
          <p className="text-sm uppercase tracking-wider text-brand-glow">
            Genesis
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-100">
            Block 0 — mined December 27, 2020
          </h1>
          <p className="mt-3 text-slate-400">
            The first block of the Tidecoin chain. Paid 50 TDC to a Falcon-512
            public key, with an IEEE Spectrum headline embedded in the coinbase
            scriptSig.
          </p>
        </div>
      </header>

      {block !== null && <BlockMeta block={block} />}

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          The headline embedded in the coinbase
        </h2>
        <blockquote className="mt-3 rounded-lg border-l-4 border-brand bg-surface-1 p-6 text-slate-200">
          <p className="text-lg italic">
            spectrum.ieee.org 09/Dec/2020 Photonic Quantum Computer Displays
            &lsquo;Supremacy&rsquo; Over Supercomputers.
          </p>
          <footer className="mt-3 text-xs text-slate-500">
            Decoded from the genesis coinbase scriptSig:{" "}
            <span className="mono break-all">
              04ffff001d01044c61737065637472756d2e696565652e6f72672030392f4465632f3230323020…
            </span>
          </footer>
        </blockquote>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-surface-3 bg-surface-1 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Article date
            </div>
            <div className="mt-1 text-slate-200">December 9, 2020</div>
            <div className="mt-2 text-xs text-slate-500">
              IEEE Spectrum coverage of the Jiuzhang photonic quantum computer
              result published by Pan Jianwei&apos;s group at USTC.
            </div>
          </div>
          <div className="rounded-lg border border-surface-3 bg-surface-1 p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">
              Block mined
            </div>
            <div className="mt-1 text-slate-200">December 27, 2020 19:09 UTC</div>
            <div className="mt-2 text-xs text-slate-500">
              18 days after the article was published.
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-400">
          The convention echoes Bitcoin&apos;s own genesis coinbase, which
          embedded{" "}
          <i>
            &ldquo;The Times 03/Jan/2009 Chancellor on brink of second bailout
            for banks&rdquo;
          </i>{" "}
          — a contemporary newspaper headline timestamping the chain&apos;s
          launch. Tidecoin&apos;s is a quantum-computing milestone from the
          same month it went live.
        </p>
      </section>

      {block !== null && block.txs.length > 0 && block.txs[0] && (
        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-wider text-slate-500">
            Coinbase output
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            The genesis coinbase pays its 50 TDC subsidy to a single output. The
            recipient is a Falcon-512 public key stored directly in the
            scriptPubKey.
          </p>
          <div className="mt-4 rounded-lg border border-surface-3 bg-surface-1 p-5">
            {block.txs[0].vout.map((out) => (
              <div key={out.n} className="mb-4 last:mb-0">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  vout #{out.n}
                </div>
                <div className="mono mt-1 text-sm text-slate-100">
                  {out.valueTdc} TDC
                </div>
                {out.pubkey && (
                  <div className="mt-2 text-xs">
                    <div className="text-slate-500">Falcon public key</div>
                    <div className="mono mt-1 break-all text-slate-400">
                      {out.pubkey.slice(0, 32)}…{out.pubkey.slice(-16)}{" "}
                      <span className="text-slate-600">
                        ({out.pubkey.length / 2} bytes)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 rounded-lg border border-surface-3 bg-surface-1 p-6 text-sm">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          Block facts
        </h2>
        <dl className="mt-3 space-y-4 sm:grid sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-6 sm:gap-y-2 sm:space-y-0">
          <dt className="text-slate-500">Height</dt>
          <dd className="mono text-slate-200">0</dd>
          <dt className="text-slate-500">Hash</dt>
          <dd className="mono break-all text-slate-200">{GENESIS_HASH}</dd>
          <dt className="text-slate-500">Time</dt>
          <dd className="text-slate-200">2020-12-27 19:09:40 UTC</dd>
          <dt className="text-slate-500">Subsidy</dt>
          <dd className="mono text-slate-200">50.00000000 TDC</dd>
          <dt className="text-slate-500">Signature scheme</dt>
          <dd className="text-slate-200">Falcon-512</dd>
        </dl>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/">← Dashboard</Link>
        <span className="mx-3 text-slate-600">·</span>
        <Link href="/richlist">Richlist</Link>
        <span className="mx-3 text-slate-600">·</span>
        <Link href="/threat-model">Threat model</Link>
      </p>
    </main>
  );
}

function BlockMeta({
  block,
}: {
  block: NonNullable<Awaited<ReturnType<typeof getBlock>>>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-surface-3 bg-surface-1 p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          Confirmations
        </div>
        <div className="mono mt-1 text-xl font-semibold text-slate-100">
          {block.confirmations.toLocaleString()}
        </div>
      </div>
      <div className="rounded-lg border border-surface-3 bg-surface-1 p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          Size
        </div>
        <div className="mono mt-1 text-xl font-semibold text-slate-100">
          {block.sizeBytes.toLocaleString()} B
        </div>
      </div>
      <div className="rounded-lg border border-surface-3 bg-surface-1 p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          Total out
        </div>
        <div className="mono mt-1 text-xl font-semibold text-slate-100">
          {block.totalOutTdc} TDC
        </div>
      </div>
    </div>
  );
}
