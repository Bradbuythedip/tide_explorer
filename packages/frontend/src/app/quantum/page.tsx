import type { Metadata } from "next";
import Link from "next/link";
import { getQuantumSupply, type QuantumSupplyResponse } from "@/lib/api";
import { DonutChart, type DonutSlice } from "@/components/DonutChart";
import { Term } from "@/components/Term";

export const metadata: Metadata = {
  title: "Quantum risk",
  description:
    "Tidecoin's quantum threat surface, measured against the live chain. Shor doesn't apply. Three other risks do, in this order: implementation/side-channel, Falcon cryptanalysis, Grover against the address hash.",
};

export const dynamic = "force-dynamic";

const SATOSHIS_PER_COIN = 100_000_000n;

export default async function QuantumPage() {
  const supply = await getQuantumSupply();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-wider text-brand-glow">
          Quantum risk
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">
          Where Tidecoin&apos;s coins actually sit on the threat axis.
        </h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Tidecoin signs every transaction with <Term name="falcon-512" /> from
          genesis. There is no ECDSA on this chain. <Term name="shor">Shor&apos;s
          algorithm</Term>, the famous quantum attack on Bitcoin, does not apply.
          What does apply is a finer question — which is what this page measures.
        </p>
      </header>

      {supply === null ? (
        <DataUnavailable />
      ) : (
        <SupplyView supply={supply} />
      )}

      <section className="mt-16">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          What this page is, and what it isn&apos;t
        </h2>
        <ul className="mt-3 space-y-3 text-sm text-slate-300">
          <li>
            <b>Not</b> a claim that Tidecoin is &ldquo;quantum-proof.&rdquo;
            That word is avoided across the site. The correct phrase is{" "}
            <i>post-quantum by construction</i>, and even that comes with
            three residual risks documented on{" "}
            <Link href="/threat-model" className="underline">
              /threat-model
            </Link>
            .
          </li>
          <li>
            <b>Not</b> a panic gauge. None of the three residual risks are
            urgent today. The page exists to make them legible — defence in
            depth is cheap, and the partition above tells you which of your
            coins have how much defence.
          </li>
          <li>
            <b>Is</b> a real measurement against the live UTXO set. Every
            number above comes from the prevblock indexer&apos;s aggregate
            over <span className="mono">prevblock.outputs WHERE spent_by_txid IS NULL</span>.
            No estimates, no extrapolation. The freshness label says when it
            was last computed.
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          The three risks, in descending likelihood
        </h2>
        <RiskCard
          variant="bare"
          title="1. Implementation bugs and side channels"
          subtitle="Highest near-term risk"
        >
          <p>
            Tidecoin signs with the PQClean Falcon-512 reference implementation.
            That implementation&apos;s Gaussian sampler is built on
            floating-point arithmetic, and floating-point operations have
            observable timing variations on many CPUs.
          </p>
          <p className="mt-3">
            Guerreau, Martinelli, Ricosset &amp; Rossi (CHES 2022) recover
            signing keys from real measurements on the reference implementation.
            Not fault injection, not invasive access — a clean side-channel
            attack on commodity hardware.{" "}
            <Link href="/threat-model" className="underline">
              Long version with citations
            </Link>
            .
          </p>
        </RiskCard>

        <RiskCard
          variant="exposed"
          title="2. Cryptanalysis of Falcon itself"
          subtitle="Medium horizon"
        >
          <p>
            <Term name="lattice-cryptography">Lattice cryptanalysis</Term> is
            an active research area. Falcon-512 is NIST level 1 (~AES-128
            classical and quantum). No break exists. The conservative
            assumption is that some erosion of the security margin is possible
            over the chain&apos;s lifetime, which is exactly why the next risk
            matters.
          </p>
          <p className="mt-3">
            If Falcon&apos;s margin ever shrinks, the{" "}
            <Term name="hash-protected" /> bucket above is your insurance: the
            <Term name="hash160">Hash160</Term> barrier still applies whether
            or not Falcon itself remains as strong as it is today.{" "}
            <Term name="pubkey-exposed" /> coins do not have that insurance.
          </p>
        </RiskCard>

        <RiskCard
          variant="safe"
          title="3. Grover's algorithm against the address hash"
          subtitle="Longest horizon, lowest concern today"
        >
          <p>
            <Term name="grover">Grover&apos;s algorithm</Term> takes Hash160
            preimage work from <span className="mono">~2^160</span> to{" "}
            <span className="mono">~2^80</span>. 2^80 is roughly a billion
            times the largest classical hash campaign ever attempted; it is
            not a near-term concern at all.
          </p>
          <p className="mt-3">
            We track it because the math is well-defined and the threat
            model deserves a coherent third vertex. Hash-protected coins get
            both the Falcon layer and the Hash160 layer; the bigger
            cryptographic event between now and a hypothetical Grover-relevant
            machine is almost certainly going to be one of risks 1 or 2.
          </p>
        </RiskCard>
      </section>

      <section className="mt-12 rounded-lg border border-surface-3 bg-surface-1 p-6 text-sm">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          Methodology
        </h2>
        <p className="mt-3 text-slate-300">
          The four numbers above come from a single SQL aggregate against the
          indexer&apos;s UTXO table. Bucket assignment is exact, not heuristic:
        </p>
        <pre className="mono mt-3 overflow-x-auto rounded bg-surface-2 p-3 text-xs text-slate-400">
{`hashProtected:  pubkey_revealed_at_height IS NULL
                AND script_type IN (p2pkh_falcon, p2wpkh_falcon,
                                     p2wsh_falcon, p2sh)

pubkeyExposed:  pubkey_revealed_at_height IS NOT NULL
                AND script_type IN (p2pkh_falcon, p2wpkh_falcon,
                                     p2wsh_falcon, p2sh)

bareP2pk:       script_type = 'p2pk_falcon'

unclassified:   script_type IN (op_return, witness_unknown, nonstandard)`}
        </pre>
        <p className="mt-3 text-slate-400">
          The indexer fills <span className="mono">pubkey_revealed_at_height</span>{" "}
          two ways: directly when an output is created bare-P2PK (the pubkey
          is on chain from the moment the output exists), and propagated when
          a Falcon witness later spends from any address that shares the
          revealed Hash160.
        </p>
      </section>

      <p className="mt-12 text-sm">
        <Link href="/">← Dashboard</Link>
        <span className="mx-3 text-slate-600">·</span>
        <Link href="/threat-model">Threat model (long)</Link>
        <span className="mx-3 text-slate-600">·</span>
        <Link href="/richlist">Richlist</Link>
      </p>
    </main>
  );
}

function SupplyView({ supply }: { supply: QuantumSupplyResponse }) {
  const total = BigInt(supply.totalSats);
  const hash = BigInt(supply.hashProtectedSats);
  const exposed = BigInt(supply.pubkeyExposedSats);
  const bare = BigInt(supply.bareP2pkSats);
  const unc = BigInt(supply.unclassifiedSats);

  const pct = (n: bigint) =>
    total > 0n ? (Number((n * 10000n) / total) / 100).toFixed(2) : "0.00";

  const slices: DonutSlice[] = [
    { label: "Hash-protected", value: Number(hash), color: "#10b981" },
    { label: "Pubkey-exposed", value: Number(exposed), color: "#f59e0b" },
    { label: "Bare P2PK", value: Number(bare), color: "#f43f5e" },
    { label: "Unclassified", value: Number(unc), color: "#475569" },
  ];

  const hashPct = pct(hash);

  return (
    <>
      {!supply.isAtTip && (
        <div className="mb-6 rounded-lg border border-threat-exposed/30 bg-threat-exposed/5 p-4 text-sm text-slate-300">
          <p className="text-threat-exposed">Indexer still catching up.</p>
          <p className="mt-1 text-slate-400">
            The numbers below cover blocks 0–{supply.asOfHeight.toLocaleString()}{" "}
            of {supply.nodeTipHeight.toLocaleString()}. The partition is
            accurate <i>for what&apos;s indexed so far</i>, not the live tip.
            The page will switch to live numbers automatically when the
            indexer catches up (≤ 6 blocks behind).
          </p>
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-[auto_1fr]">
        <DonutChart
          slices={slices}
          ariaLabel="Tidecoin UTXO supply partitioned into hash-protected, pubkey-exposed, bare P2PK, and unclassified"
          size={260}
        >
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500">
              hash-protected
            </div>
            <div className="mono mt-1 text-3xl font-semibold text-threat-safe">
              {hashPct}%
            </div>
            <div className="text-xs text-slate-500">of indexed supply</div>
          </div>
        </DonutChart>

        <div className="space-y-3">
          <Bucket
            color="#10b981"
            label="Hash-protected Falcon"
            valueTdc={supply.hashProtectedTdc}
            pct={pct(hash)}
            description="Pubkey hidden behind Hash160. Both Falcon and the address hash are intact."
          />
          <Bucket
            color="#f59e0b"
            label="Pubkey-exposed Falcon"
            valueTdc={supply.pubkeyExposedTdc}
            pct={pct(exposed)}
            description="Address was spent from. Falcon pubkey is now on chain. One layer of protection remains."
          />
          <Bucket
            color="#f43f5e"
            label="Bare P2PK Falcon"
            valueTdc={supply.bareP2pkTdc}
            pct={pct(bare)}
            description="Pubkey on chain from creation. Genesis coinbase is the canonical example."
          />
          {Number(unc) > 0 && (
            <Bucket
              color="#475569"
              label="Unclassified"
              valueTdc={supply.unclassifiedTdc}
              pct={pct(unc)}
              description="OP_RETURN, witness_unknown, nonstandard. Tracked separately so the buckets sum to total exactly."
            />
          )}
        </div>
      </section>

      <p className="mt-6 text-xs text-slate-500">
        Computed at indexer height{" "}
        <span className="mono">{supply.asOfHeight.toLocaleString()}</span>
        {supply.isAtTip
          ? " (live tip)"
          : ` — ${supply.blocksBehindTip.toLocaleString()} blocks behind tip`}
        . Total indexed supply:{" "}
        <span className="mono">{Number(supply.totalTdc).toLocaleString()} TDC</span>.
      </p>
    </>
  );
}

function Bucket({
  color,
  label,
  valueTdc,
  pct,
  description,
}: {
  color: string;
  label: string;
  valueTdc: string;
  pct: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-1 p-4">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-slate-100">{label}</span>
        </div>
        <div className="text-right">
          <div className="mono text-sm font-semibold text-slate-100">{pct}%</div>
          <div className="mono text-xs text-slate-500">
            {Number(valueTdc).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            TDC
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function DataUnavailable() {
  return (
    <div className="rounded-lg border border-threat-bare/30 bg-threat-bare/5 p-6 text-sm text-slate-300">
      <p className="text-threat-bare">Quantum supply data not available yet.</p>
      <p className="mt-2 text-slate-400">
        Either the backend isn&apos;t running, the indexer isn&apos;t connected,
        or the query failed. Check the backend logs and try again.
      </p>
      <p className="mt-2 text-slate-400">
        See <Link href="/threat-model" className="underline">/threat-model</Link>{" "}
        for the conceptual partition that this page is meant to measure.
      </p>
    </div>
  );
}

/**
 * Static class lookups so Tailwind's tree-shaker sees every variant.
 * Dynamic interpolation like `border-${color}` would silently produce
 * empty CSS in production.
 */
const RISK_VARIANTS = {
  bare: {
    border: "border-threat-bare/30",
    bg: "bg-threat-bare/5",
    text: "text-threat-bare",
  },
  exposed: {
    border: "border-threat-exposed/30",
    bg: "bg-threat-exposed/5",
    text: "text-threat-exposed",
  },
  safe: {
    border: "border-threat-safe/30",
    bg: "bg-threat-safe/5",
    text: "text-threat-safe",
  },
} as const;

function RiskCard({
  variant,
  title,
  subtitle,
  children,
}: {
  variant: keyof typeof RISK_VARIANTS;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const v = RISK_VARIANTS[variant];
  return (
    <div className={`mt-4 rounded-lg border ${v.border} ${v.bg} p-5`}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <span className={`text-xs uppercase tracking-wider ${v.text}`}>
          {subtitle}
        </span>
      </div>
      <div className="mt-3 text-sm text-slate-300">{children}</div>
    </div>
  );
}
