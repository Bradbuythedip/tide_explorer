import type { Metadata } from "next";
import Link from "next/link";
import { getBlock } from "@/lib/api";
import { Term } from "@/components/Term";

export const metadata: Metadata = {
  title: "Genesis block",
  description:
    "Tidecoin's genesis block (height 0, December 27 2020) and the photonic-quantum-supremacy headline embedded in its coinbase scriptSig. The first bare-Falcon P2PK output ever committed to a chain — and the one Tidecoin's own classifier reports as nonstandard.",
};

export const dynamic = "force-dynamic";

const GENESIS_HASH =
  "480ecc7602d8989f32483377ed66381c391dda6215aeef9e80486a7fd3018075";

export default async function GenesisPage() {
  const block = await getBlock("0");

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <p className="text-sm uppercase tracking-wider text-brand-glow">Genesis</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">
          Block 0 — December 27, 2020
        </h1>
        <p className="mt-3 text-slate-400">
          Tidecoin&apos;s first block. A bare <Term name="p2pk-falcon" /> output
          paying 50 TDC to a Falcon-512 public key, signed with a coinbase
          scriptSig that quotes a December 9, 2020 IEEE Spectrum headline about
          photonic quantum computing.
        </p>
      </header>

      {block !== null && <BlockMeta block={block} />}

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          The headline
        </h2>
        <blockquote className="mt-3 rounded-lg border-l-4 border-brand bg-surface-1 p-6 text-slate-200">
          <p className="text-lg italic">
            spectrum.ieee.org 09/Dec/2020 Photonic Quantum Computer Displays
            &lsquo;Supremacy&rsquo; Over Supercomputers.
          </p>
          <footer className="mt-3 text-xs text-slate-500">
            Embedded ASCII in the genesis coinbase scriptSig. Decoded from{" "}
            <span className="mono">
              04ffff001d01044c61737065637472756d2e696565652e6f72672030392f4465632f3230323020…
            </span>
          </footer>
        </blockquote>
        <p className="mt-4 text-sm text-slate-400">
          On the same day Bitcoin&apos;s genesis quoted a UK bank bailout —
          January 3, 2009 — Tidecoin chose a story about a Chinese lab claiming
          quantum supremacy on a photonic device. The framing was deliberate:
          this was launched as a chain for the moment when a quantum computer
          might actually matter.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          The output Tidecoin&apos;s own daemon can&apos;t classify
        </h2>
        <p className="mt-3 text-slate-300">
          Block 0&apos;s coinbase pays 50 TDC to a single output of the form
        </p>
        <pre className="mono mt-3 overflow-x-auto rounded-md border border-surface-3 bg-surface-1 p-4 text-xs text-slate-300">
          <code>OP_PUSHDATA2 0x0382 &lt;898 bytes Falcon-512 public key&gt; OP_CHECKSIG</code>
        </pre>
        <p className="mt-4 text-slate-300">
          That is a textbook bare P2PK output, except the public key is 898
          bytes (the size of a Falcon-512 key) instead of the 33 or 65 bytes
          of a Bitcoin ECDSA key. Tidecoin inherits Bitcoin Core&apos;s 0.18.3{" "}
          <span className="mono">script/standard.cpp::Solver()</span> verbatim,
          and that function&apos;s pattern matcher requires a single-byte push
          length:
        </p>
        <pre className="mono mt-3 overflow-x-auto rounded-md border border-surface-3 bg-surface-1 p-4 text-xs text-slate-400">
{`static bool MatchPayToPubkey(const CScript& script, valtype& pubkey) {
    if (script.size() == CPubKey::PUBLIC_KEY_SIZE + 2 &&
        script[0] == CPubKey::PUBLIC_KEY_SIZE &&    // <- 898 doesn't fit in a byte
        script.back() == OP_CHECKSIG) { ... }`}
        </pre>
        <p className="mt-4 text-slate-300">
          898 doesn&apos;t fit in <span className="mono">script[0]</span>; an
          898-byte push has to use <span className="mono">OP_PUSHDATA2</span>,
          so the comparison never matches. The genesis output, and every other
          bare-Falcon P2PK output on the chain, falls through to{" "}
          <span className="mono text-threat-bare">TX_NONSTANDARD</span> in the
          node&apos;s own classifier. prevblock recognises the shape directly
          and labels it{" "}
          <span className="mono text-threat-bare">p2pk_falcon</span>.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          This is the single most concrete reason this explorer exists.
          Tidecoin&apos;s own daemon has been calling its own genesis block
          &ldquo;nonstandard&rdquo; for every one of the{" "}
          <Link href="/" className="underline">
            ~2.5 million blocks
          </Link>{" "}
          since launch. prevblock is the first tool in the ecosystem that
          doesn&apos;t.
        </p>
      </section>

      {block !== null && block.txs.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-wider text-slate-500">
            Live data from the indexer
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            The same fields as a normal block detail page, applied to height 0.
            The <span className="mono">scriptType</span> field is prevblock&apos;s
            classifier; the <span className="mono">nodeType</span> field is
            what <span className="mono">getrawtransaction</span> reports.
          </p>
          <div className="mt-4 rounded-lg border border-surface-3 bg-surface-1 p-5">
            {block.txs[0]?.vout.map((out) => (
              <div key={out.n} className="mb-4 last:mb-0">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  vout #{out.n}
                </div>
                <div className="mono mt-1 text-sm text-slate-100">
                  {out.valueTdc} TDC
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-slate-500">prevblock scriptType</span>
                  <span className="mono text-threat-bare">{out.scriptType}</span>
                  <span className="text-slate-500">node scriptType</span>
                  <span className="mono text-slate-400">{out.nodeType}</span>
                  {out.pubkey && (
                    <>
                      <span className="text-slate-500">Falcon pubkey</span>
                      <span className="mono break-all text-slate-400">
                        {out.pubkey.slice(0, 32)}…{out.pubkey.slice(-16)}{" "}
                        <span className="text-slate-600">
                          ({out.pubkey.length / 2} bytes)
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-12 rounded-lg border border-surface-3 bg-surface-1 p-6 text-sm">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          Block facts
        </h2>
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
          <dt className="text-slate-500">Height</dt>
          <dd className="mono text-slate-200">0</dd>
          <dt className="text-slate-500">Hash</dt>
          <dd className="mono break-all text-slate-200">{GENESIS_HASH}</dd>
          <dt className="text-slate-500">Time</dt>
          <dd className="text-slate-200">2020-12-27 19:09:40 UTC</dd>
          <dt className="text-slate-500">Subsidy</dt>
          <dd className="mono text-slate-200">50.00000000 TDC</dd>
          <dt className="text-slate-500">Signature scheme</dt>
          <dd className="text-slate-200">
            <Term name="falcon-512" />
          </dd>
          <dt className="text-slate-500">Source</dt>
          <dd className="mono text-slate-400">
            chainparams.cpp:115 — assert(consensus.hashGenesisBlock == 0x480ecc…)
          </dd>
        </dl>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/">← Dashboard</Link>
        <span className="mx-3 text-slate-600">·</span>
        <Link href="/quantum">Quantum risk</Link>
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
