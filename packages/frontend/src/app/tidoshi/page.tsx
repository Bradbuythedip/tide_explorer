import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Schelling Asset of Q-Day",
  description:
    "A structural thesis for Tidecoin as the post-quantum continuation of Bitcoin. By Tidoshi.",
  openGraph: {
    title: "The Schelling Asset of Q-Day",
    description:
      "A structural thesis for Tidecoin as the post-quantum continuation of Bitcoin.",
    type: "article",
  },
};

export default function TidoshiPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <article className="text-slate-200">
        <header className="mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-glow">
            Working Paper
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-100 sm:text-4xl">
            The Schelling Asset of Q-Day
          </h1>
          <p className="mt-2 text-lg text-slate-400">
            A Structural Thesis for Tidecoin as the Post-Quantum Continuation
            of Bitcoin
          </p>
          <p className="mt-4 text-sm italic text-slate-400">
            — Tidoshi &bull; Independent research
          </p>
        </header>

        <ReaderBox>
          <strong className="text-brand-glow">
            Who this is for, and how to read it.
          </strong>{" "}
          This paper is written for three readers. The{" "}
          <strong>Bitcoin holder</strong> considering whether to allocate to a
          post-quantum hedge: read the executive summary and &sect;4. The{" "}
          <strong>developer</strong> evaluating whether to contribute to a small
          open-source project with leverage: read &sect;5 and &sect;7. The{" "}
          <strong>analyst</strong> tracking post-quantum cryptocurrency
          proposals: read &sect;2 and verify the citations. The full paper is
          approximately a 25-minute read; the executive summary alone is 3
          minutes and contains the spine of the argument.
        </ReaderBox>

        <ExecBox />
        <S1 />
        <S2 />
        <S3 />
        <S4 />
        <S5 />
        <S6 />
        <S7 />
        <S8 />
        <S9 />
        <Refs />

        <footer className="mt-16 border-t border-surface-2 pt-8">
          <p className="text-xs text-slate-600">
            Hosted on prevblock.com — the Tidecoin block explorer. The text
            above is reproduced as-received and unedited.
          </p>
          <nav className="mt-6 text-sm">
            <Link href="/">← Dashboard</Link>
            <span className="mx-3 text-slate-700">·</span>
            <Link href="/genesis">Genesis</Link>
            <span className="mx-3 text-slate-700">·</span>
            <Link href="/quantum">Quantum</Link>
          </nav>
        </footer>
      </article>
    </main>
  );
}

/* ── Shared helpers ── */

function RB({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-8 rounded border border-slate-700 bg-surface-1 px-5 py-4 text-sm text-slate-300">
      {children}
    </div>
  );
}
const ReaderBox = RB;

function VerifyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded border border-slate-700/50 bg-surface-1 px-4 py-3 text-xs text-slate-500">
      {children}
    </div>
  );
}

function PQ({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="my-8 border-l-2 border-brand-glow pl-6 text-lg italic text-brand-glow/90">
      {children}
    </blockquote>
  );
}

function SH({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-1 mt-16 text-xl font-semibold text-slate-100">
      <span className="mr-2 text-brand-glow">{n}.</span>
      {children}
    </h2>
  );
}

function BL({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-sm font-semibold text-brand-glow">{children}</p>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-base leading-relaxed text-slate-300">{children}</p>
  );
}

/* ── Stub sections — will be filled ── */
function ExecBox() {
  return (
    <div className="mb-12 rounded border border-brand-glow/40 bg-brand-glow/5 px-6 py-5 text-sm text-slate-300">
      <p className="mb-3 text-base font-bold text-brand-glow">
        EXECUTIVE SUMMARY
      </p>

      <p className="mb-3">
        <strong className="text-slate-100">The decision framework.</strong>{" "}
        Mosca&apos;s inequality says: if X+Y &gt; Z, you should worry. X is how
        long the data must remain secure. Y is how long the migration takes. Z
        is the time until a quantum computer can break the cryptography.
        Bitcoin&apos;s X is forever. Its Y has not begun in any binding way.
        Estimates of Z have collapsed: the 2026 Chevignard result reduced the
        qubit cost of breaking ECC to{" "}
        <strong className="text-slate-100">1,193 logical qubits</strong>, with
        subsequent unconditional optimization to 780. Mosca himself estimated in
        2015 that there was a 1-in-7 chance of public-key crypto being broken by
        2026, and 1-in-2 by 2031. Today is 2026.
      </p>

      <p className="mb-3">
        <strong className="text-slate-100">The frame.</strong> A post-quantum
        cascade forces a Schelling decision among three configurations:{" "}
        <strong>(a)</strong> Bitcoin soft-forks PQ in place,{" "}
        <strong>(b)</strong> a successor chain inherits Bitcoin&apos;s properties
        under a PQ primitive, <strong>(c)</strong> BTC is bridged into a PQ
        envelope. Configuration (a) is now actively being attempted via{" "}
        <strong className="text-slate-100">BIP-360</strong>. Its fault
        line — whether to freeze dormant Satoshi-era coins or permit their
        quantum theft — is observable in current bitcoindev debate.
        Configuration (a) being attempted does <em>not</em> kill the thesis; it
        confirms it.
      </p>

      <p className="mb-3">
        <strong className="text-slate-100">The asset.</strong> Tidecoin (TDC),
        launched December 2020 by the pseudonymous EverettX, is the only
        existing chain satisfying configuration (b) under a strict reading:{" "}
        <strong className="text-slate-100">Falcon-512</strong> signatures (now
        NIST FN-DSA, included as a candidate in BIP-360), Nakamoto PoW, fair
        launch, no premine, no foundation treasury,{" "}
        <strong className="text-slate-100">
          21,000,000 max supply identical to Bitcoin
        </strong>
        , founder departed, community maintenance under the Tidecoin Foundation
        organization.
      </p>

      <p className="mb-3">
        <strong className="text-slate-100">The asymmetry.</strong> TDC market
        capitalization is approximately{" "}
        <strong className="text-slate-100">$1.5 million</strong>. A 1%
        post-quantum hedge against Bitcoin&apos;s ~$1.5 trillion implies hedge
        demand of approximately{" "}
        <strong className="text-slate-100">$15 billion</strong>. The arithmetic
        gap is approximately 10<sup>4</sup>.
      </p>

      <p>
        <strong className="text-slate-100">The honest probability.</strong>{" "}
        Joint probability of the full ultra-bull outcome:{" "}
        <strong className="text-slate-100">1–5%</strong>. Expected value:
        10&times;–50&times;. Sized as a small allocation, not a primary thesis.{" "}
        <em>
          Internal narrative coherence is not the same as base rate; size against
          the probability, not the elegance.
        </em>
      </p>
    </div>
  );
}
function S1() {
  return (
    <section>
      <SH n={1}>Mosca&apos;s inequality now says &ldquo;worry&rdquo;</SH>
      <BL>
        Bitcoin satisfies Mosca&apos;s inequality under any reasonable estimate
        of current inputs. The cascade is not a future event; the academic
        update has already happened, and the market update has not.
      </BL>
      <P>
        The threat of large-scale fault-tolerant quantum computation to
        Bitcoin&apos;s signature scheme has been understood since Shor 1994. The
        standard decision framework is Mosca&apos;s inequality: if the time your
        data must stay secure (X), plus the time it takes to migrate to
        post-quantum cryptography (Y), exceeds the time until a quantum computer
        can break it (Z), then it is already too late to begin migrating. For
        Bitcoin, X is effectively forever — the chain&apos;s value depends on
        the immutable validity of historical signatures. Y is the multi-year
        coordination time of any soft-fork upgrade. Z is the variable that
        academic and industry communities have spent the last decade trying to
        estimate, and that has been collapsing in one direction.
      </P>
      <P>
        The 2017 Roetteler–Naehrig–Svore–Lauter estimate placed the logical
        qubit cost of breaking 256-bit ECC near 2,330. The 2026
        Chevignard–Fouque–Schrottenloher result reduced this to 1,193.
        Subsequent unconditional optimization brings it to 780. None of these
        results changes the date a cryptographically relevant quantum computer
        will exist; what they change is the difficulty of arguing the date is
        comfortably distant.
      </P>
      <PQ>
        Mosca&apos;s 2015 estimate: a 1-in-7 chance of public-key crypto being
        broken by 2026, and 1-in-2 by 2031. Today is 2026.
      </PQ>
      <P>
        The custodial markets for Bitcoin have not repriced this shift, because
        markets reprice on <em>events</em>, not on shifts in probability
        distributions over future events. The window between the academic update
        (already happened) and the custodial-market update (has not happened) is
        the structural mispricing this paper exists to identify.
      </P>
      <P>
        A reader who believes the cascade probability is approximately zero on
        any investable horizon should stop here. The remainder of this document
        will not change their mind, because the disagreement is upstream of
        every argument that follows.
      </P>
    </section>
  );
}
function S2() {
  return (
    <section>
      <SH n={2}>
        Bitcoin&apos;s own developers are now fighting about exactly this
      </SH>
      <BL>
        Configuration (a) — Bitcoin migrating in place — is being attempted
        right now via BIP-360. The fight over how to handle dormant coins is
        the empirical confirmation of the fault line this paper predicts.
        Configuration (a) being attempted does not kill the thesis. It validates
        it.
      </BL>
      <P>
        A post-quantum cascade forces a Schelling decision among three
        logically exhaustive configurations.
      </P>

      {/* Three-config diagram */}
      <div className="my-8 overflow-x-auto">
        <div className="mx-auto flex flex-col items-center gap-4">
          <div className="rounded border border-brand-glow/40 bg-surface-1 px-4 py-2 text-center text-sm font-semibold text-slate-100">
            Q-Day forces a Schelling decision
          </div>
          <div className="flex w-full justify-center gap-1 text-brand-glow">
            <span>↓</span><span className="mx-8">↓</span><span>↓</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {([
              ["(a) In-place", "Bitcoin soft-forks PQ signatures", "BIP-360", "Dormant coins cannot migrate; social fork on burn vs. theft"],
              ["(b) Successor", "New chain inherits Bitcoin properties", "Tidecoin", "Filtered out by 'PQ coin = scam' market heuristic; thin float"],
              ["(c) Wrapped", "BTC bridged into PQ envelope", "", "Bridge security under quantum adversary; worst category history"],
            ] as const).map(([title, desc, note, fail]) => (
              <div key={title} className="flex flex-col gap-2">
                <div className="rounded border border-slate-600 bg-surface-1 p-3 text-center text-sm">
                  <p className="font-bold text-slate-100">{title}</p>
                  <p className="mt-1 text-slate-400">{desc}</p>
                  {note && (
                    <p className="mt-1 text-xs italic text-brand-glow">{note}</p>
                  )}
                </div>
                <div className="rounded border border-dashed border-rose-800/60 bg-rose-950/20 p-2 text-xs text-rose-400">
                  <strong>Failure mode:</strong> {fail}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-xs italic text-slate-500">
            Figure 1. The three logically exhaustive configurations and their
            dominant failure modes. The configurations are not mutually
            exclusive; the actual outcome is a weighted combination determined
            by market coordination.
          </p>
        </div>
      </div>

      <P>
        The strongest evidence for this paper&apos;s framing is not theoretical.
        Configuration (a) is being attempted right now, with named proposals,
        named proponents, named opponents, and a debate that has split exactly
        along the fault line predicted by the dormant-coin problem.
      </P>
      <P>
        <strong className="text-slate-100">BIP-360</strong> (
        <em>Pay-to-Quantum-Resistant-Hash</em>, P2QRH), authored by Hunter
        Beast, Ethan Heilman, and Isabel Foxen Duke, proposes a new Bitcoin
        output type committing to one or more post-quantum signature schemes,
        riding on SegWit version 3 with addresses beginning{" "}
        <code className="text-xs text-slate-400">bc1r</code>. The candidate
        schemes named in the current draft include FALCON, ML-DSA, and SLH-DSA.
        Falcon&apos;s inclusion is the most important external validation
        available for Tidecoin&apos;s 2020 primitive choice:{" "}
        <em>
          Bitcoin&apos;s own quantum-resistance proposers, working
          independently, arrived at the same primitive Tidecoin shipped five
          years earlier.
        </em>
      </P>
      <P>
        <strong className="text-slate-100">
          The Lopp–Papathanasiou sunset proposal
        </strong>{" "}
        is structurally distinct and more aggressive. Drafted in mid-2025 by
        Jameson Lopp and Christian Papathanasiou, it proposes a phased
        migration: Phase A disallows new sends to quantum-vulnerable address
        types; Phase B, triggered by a flag day approximately five years later,
        renders ECDSA and Schnorr spends invalid altogether, freezing any UTXO
        not migrated by the deadline. The proposal&apos;s stated intent is to
        convert quantum security from a public good into a private incentive:{" "}
        <em>
          fail to upgrade and you will certainly lose access to your funds.
        </em>
      </P>
      <P>
        <strong className="text-slate-100">
          The opposition is similarly named.
        </strong>{" "}
        Adam Back and Samson Mow have publicly argued the threat is not imminent
        and the urgency is premature. The bitcoindev mailing list has been split
        on whether dormant coins should be confiscated or permitted to be
        quantum-recovered. One side argues freezing is necessary to prevent
        catastrophic theft. The other argues confiscation violates the
        immutability property that gives Bitcoin its value.
      </P>
      <PQ>
        This is the social fork the paper predicted, observable verbatim in
        mailing list threads available to any reader.
      </PQ>
      <P>
        <strong className="text-slate-100">
          The implication for this paper&apos;s thesis is precisely the opposite
          of what a casual reader expects.
        </strong>{" "}
        Configuration (a) being attempted does not kill the configuration (b)
        thesis. It validates it. The fault line within (a) is exactly the
        failure mode the &sect;1 frame predicted, and its
        resolution — whichever way it goes — creates demand for a hedge
        against the loser.
      </P>
      <P>
        If the freezing camp wins, holders of dormant coins and
        immutability-sympathetic Bitcoiners need exposure to a chain that did
        not have to make this choice. If the non-freezing camp wins, holders
        facing the prospect of quantum theft of dormant tranches need exposure
        to a chain whose dormant tranches do not exist (Tidecoin&apos;s fair
        launch having no premine and the founder having departed without a known
        dormant balance).{" "}
        <em>
          The configuration (a) attempt creates the demand for the
          configuration (b) hedge regardless of which side prevails.
        </em>
      </P>
      <VerifyBox>
        <strong>Verify:</strong>{" "}
        <code>bip360.org</code> (BIP-360 specification and authors).{" "}
        <code>qbip.org</code> (Lopp–Papathanasiou sunset proposal).{" "}
        <code>bitcoinops.org/en/topics/quantum-resistance/</code> (Bitcoin
        Optech bibliography). The Google Group <code>bitcoindev</code> archive
        contains the full debate, including the named opposition.
      </VerifyBox>
    </section>
  );
}
function S3() {
  return (
    <section>
      <SH n={3}>Tidecoin is the only chain that fits the criteria</SH>
      <BL>
        Tidecoin satisfies the configuration (b) criteria under a strict
        reading: right primitive, fair launch, no foundation treasury, identical
        21M supply cap to Bitcoin, founder departed, community maintenance
        picked up. The implementation is rough at the surface; the structural
        properties are not synthesizable after the fact.
      </BL>
      <P>
        Tidecoin (TDC) was published as a whitepaper on December 10, 2020, by
        an author using the pseudonym EverettX. Mainnet launched seventeen days
        later. The chain&apos;s design choices map onto the configuration (b)
        criteria as follows:
      </P>

      {/* Criteria table */}
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-600 text-xs uppercase tracking-wider text-slate-400">
              <th className="pb-2 pr-4 font-medium">Criterion</th>
              <th className="pb-2 font-medium">Tidecoin</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {([
              ["Signature scheme", "Falcon-512 / FN-DSA; included as a candidate in BIP-360"],
              ["Consensus", "Nakamoto PoW; yespower (CPU-friendly, ASIC-resistant)"],
              ["Issuance", "Fair launch; no premine; no founder allocation; no foundation treasury"],
              ["Maximum supply", "21,000,000 TDC, identical to Bitcoin"],
              ["Circulating supply (~2026)", "18.76M"],
              ["Market cap (~2026)", "$1.4–2.6M (sources: Bybit, LBank, CoinGecko)"],
              ["Block time", "60 seconds"],
              ["Founder presence", 'Pseudonymous ("EverettX"); no public activity since shortly after launch'],
              ["Maintenance", "Community maintenance under the Tidecoin Foundation organization (§5)"],
              ["Governance", "TIP process; no foundation treasury; no upgrade authority over monetary policy"],
              ["Genesis signature", "Coinbase embeds a quantum-supremacy news headline"],
              ["History", "Approximately five years of uninterrupted PoW"],
            ] as [string, string][]).map(([k, v]) => (
              <tr key={k} className="border-b border-slate-800">
                <td className="py-2 pr-4 font-medium text-slate-100 align-top whitespace-nowrap">{k}</td>
                <td className="py-2">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs italic text-slate-500">
          Table 1. The configuration (b) criteria, applied. The 21,000,000
          maximum supply identical to Bitcoin is a deliberate, structurally
          significant design echo.
        </p>
      </div>

      <h3 className="mt-10 mb-1 text-base font-semibold text-slate-100">
        3.1 Why Falcon is the only defensible choice
      </h3>
      <P>
        For a UTXO-model chain in which every input carries a signature,
        signature size is destiny. Among NIST-standardized post-quantum schemes,
        only Falcon has sub-kilobyte signatures.
      </P>

      {/* Signature-size table */}
      <div className="my-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-600 text-xs uppercase tracking-wider text-slate-400">
              <th className="pb-2 pr-4 font-medium">Scheme</th>
              <th className="pb-2 pr-4 font-medium text-right">Sig (B)</th>
              <th className="pb-2 pr-4 font-medium text-right">PubKey (B)</th>
              <th className="pb-2 font-medium">UTXO viability</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {([
              ["ECDSA secp256k1 (baseline)", "71–72", "33", "(Bitcoin status quo)", false],
              ["Falcon-512 / FN-DSA", "~666", "897", "Viable; in BIP-360", true],
              ["ML-DSA-44 (Dilithium)", "2,420", "1,312", "Marginal", false],
              ["ML-DSA-65", "3,293", "1,952", "Difficult", false],
              ["SLH-DSA-128s (SPHINCS+)", "7,856", "32", "Infeasible", false],
              ["SLH-DSA-128f", "17,088", "32", "Infeasible", false],
            ] as [string, string, string, string, boolean][]).map(([scheme, sig, pk, viability, highlight]) => (
              <tr key={scheme} className={`border-b border-slate-800 ${highlight ? "text-brand-glow font-medium" : ""}`}>
                <td className="py-2 pr-4 whitespace-nowrap">{scheme}</td>
                <td className="py-2 pr-4 text-right font-mono text-xs">{sig}</td>
                <td className="py-2 pr-4 text-right font-mono text-xs">{pk}</td>
                <td className="py-2">{viability}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs italic text-slate-500">
          Table 2. NIST-standardized PQ signatures by size. Falcon is the only
          candidate whose size profile permits Bitcoin-style economics. Tidecoin
          made this choice in 2020, before standardization completed.
        </p>
      </div>

      <P>
        <strong className="text-slate-100">
          Anatomy of a Tidecoin object.
        </strong>{" "}
        Addresses use base58 prefix <code className="text-xs text-slate-400">0x21</code>{" "}
        (decimal 33) and begin with the character{" "}
        <code className="text-xs text-slate-400">E</code>. Public keys are 897
        bytes prefixed with magic byte{" "}
        <code className="text-xs text-slate-400">0x07</code>. Signatures are
        bounded above by 666 bytes (~9&times; ECDSA). Block target spacing is
        60 seconds;{" "}
        <code className="text-xs text-slate-400">MAX_BLOCK_WEIGHT</code> is
        6,000,000. Genesis block hash is{" "}
        <code className="text-xs text-slate-400 break-all">
          0x480ecc7602d8989f32483377ed66381c391dda6215aeef9e80486a7fd3018075
        </code>
        ; the genesis output script is the literal 897-byte Falcon pubkey
        wrapped in <code className="text-xs text-slate-400">OP_CHECKSIG</code>.
      </P>
    </section>
  );
}
function S4() {
  return (
    <section>
      <SH n={4}>
        The hedge math: a 10,000&times; gap
      </SH>
      <BL>
        If 1% of Bitcoin holders rationally hedge against post-quantum
        transition risk, the implied demand for the configuration (b) instrument
        is approximately ten thousand times Tidecoin&apos;s current market
        capitalization. The bet does not require this demand to materialize in
        full.
      </BL>
      <P>
        The strongest demand-side argument does not require Tidecoin to displace
        Bitcoin. It requires Tidecoin to function as a hedge that Bitcoin
        holders rationally purchase against the transition risk of their primary
        holding. A Bitcoin holder facing the configuration uncertainty has a
        clean portfolio solution: hold the primary position in BTC, and allocate
        a small fraction to the asset that wins under (b).
      </P>

      {/* Bar chart */}
      <div className="my-8">
        <svg viewBox="0 0 500 160" className="w-full" role="img" aria-label="Hedge math bar chart">
          {/* Axis */}
          <line x1="120" y1="140" x2="490" y2="140" stroke="#475569" strokeWidth="1" />
          {["$1M","$10M","$100M","$1B","$10B","$100B","$1T"].map((l, i) => (
            <g key={l}>
              <line x1={120 + i * 55} y1="138" x2={120 + i * 55} y2="142" stroke="#475569" />
              <text x={120 + i * 55} y="154" textAnchor="middle" className="fill-slate-500" fontSize="9">{l}</text>
            </g>
          ))}
          <text x="300" y="160" textAnchor="middle" className="fill-slate-600 italic" fontSize="8">(log scale)</text>

          {/* Bars */}
          <rect x="120" y="10" width="10" height="20" rx="2" className="fill-rose-600" />
          <text x="135" y="24" className="fill-slate-300" fontSize="10">Tidecoin current cap ~$1.5M</text>

          <rect x="120" y="40" width="260" height="20" rx="2" className="fill-brand-glow/50" />
          <text x="385" y="54" className="fill-slate-300" fontSize="10">1% BTC hedge demand ~$15B</text>

          <rect x="120" y="70" width="300" height="20" rx="2" className="fill-brand-glow/70" />
          <text x="425" y="84" className="fill-slate-300" fontSize="10">5% hedge ~$75B</text>

          <rect x="120" y="100" width="370" height="20" rx="2" className="fill-slate-400" />
          <text x="385" y="130" className="fill-slate-300" fontSize="10">Bitcoin cap ~$1.5T</text>

          {/* Gap arrow */}
          <line x1="130" y1="35" x2="380" y2="35" stroke="#f43f5e" strokeWidth="1.5" markerEnd="url(#arrowR)" markerStart="url(#arrowL)" />
          <text x="250" y="33" textAnchor="middle" className="fill-rose-400 font-semibold" fontSize="10">~10,000× gap</text>
          <defs>
            <marker id="arrowR" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#f43f5e" /></marker>
            <marker id="arrowL" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6" fill="#f43f5e" /></marker>
          </defs>
        </svg>
        <p className="mt-2 text-center text-xs italic text-slate-500">
          Figure 2. The asymmetry. Capturing 1% of the lower-bound hedge demand
          is approximately a 100&times; move from current levels; capturing 10%
          is approximately a 1,000&times; move.
        </p>
      </div>
    </section>
  );
}
function S5() {
  return (
    <section>
      <SH n={5}>
        The founder left. The community picked it up. This is the Bitcoin
        pattern.
      </SH>
      <BL>
        EverettX departed Tidecoin much as Satoshi departed Bitcoin. Community
        maintenance picked up under the Tidecoin Foundation organization, with a
        BIP-style improvement process and reproducible signed builds. This is
        not a deviation from configuration (b); it is the same trajectory
        Bitcoin followed, observed earlier in the life cycle.
      </BL>
      <P>
        The most under-appreciated structural fact about Tidecoin is that its
        evolution has <em>followed</em> rather than diverged from the Bitcoin
        pattern. EverettX, like Satoshi, launched the chain pseudonymously,
        participated briefly during the early mainnet period, and departed. The
        chain did not die. Community maintenance picked up under the{" "}
        <strong className="text-slate-100">Tidecoin Foundation</strong>{" "}
        organization (<code className="text-xs text-slate-400">github.com/tidecoin</code>),
        which now hosts approximately twenty repositories spanning the core
        protocol, a JavaScript library, a Web3 wallet browser extension, an
        Android miner, network bootstrap seeds, the post-quantum primitive
        library, the BIP-style improvement proposal process (
        <code className="text-xs text-slate-400">tips</code>), and reproducible
        signed builds (<code className="text-xs text-slate-400">guix.sigs</code>)
        with attestations updated as recently as February 2026.
      </P>
      <P>
        <strong className="text-slate-100">
          This is the Bitcoin pattern, not a deviation from it.
        </strong>{" "}
        Bitcoin&apos;s first community maintainer was Gavin Andresen; its second
        was Wladimir van der Laan; its third generation was a distributed set of
        contributors operating under BIPs and Guix-based reproducible builds.
        None of these maintainers had upgrade authority over Bitcoin&apos;s
        monetary policy. They were stewards of an implementation whose monetary
        rules were fixed in code by an absent founder. The protection against
        their capture was not their anonymity — they were named — but the
        structural fact that any unilateral change to monetary policy would
        create a fork that holders could reject.
      </P>
      <PQ>
        Tidecoin is at the maintenance stage Bitcoin was at during the
        Andresen-to-Van-der-Laan handoff window, not the stage Bitcoin is at
        now.
      </PQ>
      <P>
        Tidecoin has reached the same configuration earlier in its life cycle.
        The Foundation has named contributors. The TIP process exists.
        Reproducible builds are being attested. The 21,000,000 supply cap is
        fixed in genesis code. A maintainer who proposed changing the issuance
        curve would face the same outcome a Bitcoin Core maintainer would: a
        fork the holders did not follow.
      </P>
      <P>
        The named-contributor model is a partial deviation from
        pseudonymous-founder purity, and a careful reader should note this
        rather than have it papered over. The mitigation is structural: the
        protocol has no upgrade authority that can unilaterally change monetary
        policy, and any contributor (or coordinated set) attempting to do so
        faces the same fork-and-rejection mechanism that protects Bitcoin from
        its own maintainers. The risk is non-zero and is weighted in &sect;8.
        The maintenance-stage observation is also a feature for participants,
        not a defect: the organization is small enough that competent
        contributors have outsized influence on the trajectory; the codebase is
        unmodernized enough that the work is well-defined; the user base is
        small enough that the social cost of mistakes is low.
      </P>
      <VerifyBox>
        <strong>Verify:</strong>{" "}
        <code>github.com/tidecoin</code>. Confirm <code>guix.sigs</code> (most
        recent commit date should be within months of this paper&apos;s date).
        Confirm <code>tips</code>. Confirm there is no foundation treasury
        repository, no premine wallet, no governance token contract.
      </VerifyBox>
    </section>
  );
}
function S6() {
  return (
    <section>
      <SH n={6}>What you&apos;re probably thinking right now</SH>
      <BL>
        Five objections likely to fire in a careful reader&apos;s mind. Each
        gets a direct answer; none of them kills the thesis.
      </BL>

      <div className="mt-6 space-y-6 text-base leading-relaxed text-slate-300">
        <div>
          <p className="font-semibold text-slate-100">
            &ldquo;BIP-360 is happening, doesn&apos;t that kill the
            thesis?&rdquo;
          </p>
          <p className="mt-1">
            The opposite. BIP-360 being attempted is empirical confirmation that
            configuration (a) is the consensus expectation and that the
            dormant-coin fault line is the active fault line. The thesis is
            structured as a hedge against (a) failing on its known fault line,
            not as a bet that (a) won&apos;t be tried. The cleaner (a) ships,
            the lower the demand for (b); the messier (a) ships, the higher the
            demand. The probability-weighted expected demand is robust across
            the realistic distribution. See &sect;2.
          </p>
        </div>

        <div>
          <p className="font-semibold text-slate-100">
            &ldquo;QRL already exists&rdquo;
          </p>
          <p className="mt-1">
            QRL uses XMSS, a stateful hash-based scheme structurally
            incompatible with hardware wallets and most custody software. QRL
            also has a foundation treasury and active discretionary governance,
            both defections from configuration (b) criteria. It is a coherent
            project; it is not the same product.
          </p>
        </div>

        <div>
          <p className="font-semibold text-slate-100">
            &ldquo;The Tidecoin Core base is too old&rdquo;
          </p>
          <p className="mt-1">
            <em>
              This is the strongest version of the technical objection, and the
              answer is honest: yes, that is correct, and modernization is the
              active maintenance frontier.
            </em>{" "}
            Tidecoin was forked from Bitcoin Core 0.18.3 (2019); upstream is now
            at 28.x. What Tidecoin lacks since 2019 includes Taproot/Schnorr,
            package relay, V2 P2P transport (BIP324), AssumeUTXO, miniscript,
            mature descriptor wallets, and significant mempool DoS hardening.
            What Tidecoin has <em>not</em> lost is consensus correctness on its
            own rules: the chain has produced agreed-upon blocks for
            approximately five years against its genesis rule set. The
            modernization roadmap (&sect;7) is the path forward, not a
            hand-wave.
          </p>
        </div>

        <div>
          <p className="font-semibold text-slate-100">
            &ldquo;Foundation contributors are named, doesn&apos;t that break
            (b)?&rdquo;
          </p>
          <p className="mt-1">
            It modifies it. &sect;5 develops the structural mitigation: the
            protection is fixed monetary policy plus holder fork option, not
            contributor anonymity. Bitcoin&apos;s named maintainers have not
            been able to unilaterally alter its monetary policy; the same
            structural protection applies here.
          </p>
        </div>

        <div>
          <p className="font-semibold text-slate-100">
            &ldquo;Why hasn&apos;t the market figured this out?&rdquo;
          </p>
          <p className="mt-1">
            The thesis only works because the market hasn&apos;t figured it out.
            The conditions for the trade and the conditions for its absence are
            the same conditions, which is the structural feature of every
            contrarian bet. The relevant question is whether the reasons others
            haven&apos;t seen it will persist, not why they exist now.
          </p>
        </div>
      </div>
    </section>
  );
}
function S7() {
  return (
    <section>
      <SH n={7}>
        The code is old but improvable; here is the roadmap
      </SH>
      <BL>
        Tidecoin&apos;s technical position is the early-Bitcoin-Core-maintenance
        phase. The defects are localized to wallet and script-policy layers;
        consensus is correct. The modernization roadmap has five items in
        priority order, of which four are weekend-to-month work and one is the
        binding constraint on the entire thesis: contributor recruitment.
      </BL>
      <P>
        <strong className="text-slate-100">Baseline.</strong> The original
        codebase, preserved in{" "}
        <code className="text-xs text-slate-400">tidecoin-old/tidecoin</code>,
        was a fork of Bitcoin Core 0.18.3 with the Falcon-512 reference C
        implementation bolted in at the wallet layer. The defects most often
        cited against the project —{" "}
        <code className="text-xs text-slate-400">CKey::Sign</code> returning
        success on cryptographic failure,{" "}
        <code className="text-xs text-slate-400">CPubKey::IsFullyValid</code>{" "}
        calling{" "}
        <code className="text-xs text-slate-400">secp256k1_ec_pubkey_parse</code>{" "}
        on Falcon pubkeys, BIP66/BIP146 enforcement commented out, raw{" "}
        <code className="text-xs text-slate-400">printf</code> in cryptographic
        paths — are real but localized: none is in consensus code. The chain
        has produced agreed-upon blocks for five years notwithstanding these
        defects, which is empirical evidence that the consensus surface is
        correct even where the surrounding code is not polished.
      </P>
      <P>
        <strong className="text-slate-100">Frontier.</strong> The Tidecoin
        Foundation organization is the maintenance frontier:{" "}
        <code className="text-xs text-slate-400">guix.sigs</code> commit
        activity in early 2026; the{" "}
        <code className="text-xs text-slate-400">tips</code> BIP-style
        governance process; multi-repository ecosystem; ongoing footgun
        remediation against the original codebase. Readers should verify the
        active fork&apos;s current state against the historical baseline rather
        than relying on this paper&apos;s prose.
      </P>
      <P>
        <strong className="text-slate-100">Roadmap.</strong> Five items in
        priority order:
      </P>
      <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm text-slate-300">
        <li>
          <strong className="text-slate-100">
            Formalize the Falcon script-policy layer.
          </strong>{" "}
          Restore the BIP66/BIP146 defense-in-depth that was removed, replacing
          it with Falcon-aware length and prefix checks. Weekend work.
        </li>
        <li>
          <strong className="text-slate-100">
            Fix the wallet-layer defects.
          </strong>{" "}
          Return-on-failure, stale validation, logging. Weekend work.
        </li>
        <li>
          <strong className="text-slate-100">
            Rebase against modern Bitcoin Core.
          </strong>{" "}
          Brings six years of upstream security work, V2 P2P transport,
          descriptor wallets, package relay, AssumeUTXO. Months of well-defined
          work.
        </li>
        <li>
          <strong className="text-slate-100">
            Evaluate Taproot for Falcon.
          </strong>{" "}
          Open research question. Some properties translate; others require
          redesign.
        </li>
        <li>
          <strong className="text-slate-100">
            Expand the contributor base.
          </strong>{" "}
          <em>The binding constraint on the entire thesis.</em> A
          four-named-contributor maintenance organization is one bus-factor
          failure away from re-abandonment. The single highest-leverage social
          investment in the project is recruitment.
        </li>
      </ol>
    </section>
  );
}
function S8() {
  const risks: [string, number, number, string][] = [
    ["(a) ships cleanly", 25, 40, "rose"],
    ["Slow cascade timing", 30, 50, "rose"],
    ["Alt (b) emerges", 20, 30, "brand"],
    ["Foundation capture", 5, 15, "brand"],
    ["Bus factor collapse", 15, 25, "brand"],
  ];
  return (
    <section>
      <SH n={8}>What could go wrong (honest probabilities)</SH>
      <BL>
        Five dominant risks, each weighted as a probability range. Multiplying
        through, the joint probability of the full ultra-bull outcome is
        1–5%. The bet is asymmetric on a ~10,000&times; gap, and small
        allocation is the right sizing.
      </BL>

      {/* Risk chart */}
      <div className="my-8">
        <svg viewBox="0 0 480 180" className="w-full" role="img" aria-label="Risk probability chart">
          {risks.map(([label, lo, hi, color], i) => {
            const y = 10 + i * 30;
            const barColor = color === "rose" ? "#e11d48" : "#10b981";
            const barLight = color === "rose" ? "#fb7185" : "#34d399";
            return (
              <g key={label}>
                <text x="140" y={y + 14} textAnchor="end" className="fill-slate-300" fontSize="10">{label}</text>
                <rect x="148" y={y} width={hi * 5} height="18" rx="2" fill={barLight} opacity="0.3" />
                <rect x={148 + lo * 5} y={y} width={(hi - lo) * 5} height="18" rx="2" fill={barColor} opacity="0.7" />
                <text x={148 + hi * 5 + 6} y={y + 13} className="fill-slate-400" fontSize="9">{lo}–{hi}%</text>
              </g>
            );
          })}
          {/* Axis */}
          <line x1="148" y1="162" x2="410" y2="162" stroke="#475569" strokeWidth="1" />
          {[0, 10, 20, 30, 40, 50].map((pct) => (
            <g key={pct}>
              <line x1={148 + pct * 5} y1="160" x2={148 + pct * 5} y2="164" stroke="#475569" />
              <text x={148 + pct * 5} y="175" textAnchor="middle" className="fill-slate-500" fontSize="8">{pct}%</text>
            </g>
          ))}
        </svg>
        <p className="mt-2 text-center text-xs italic text-slate-500">
          Figure 3. The five dominant risks with probability ranges. The first
          two are upside-killers (the thesis fails to fire); the last three are
          loss risks (Tidecoin fails to capture the demand).
        </p>
      </div>

      <P>
        Multiplying through, the joint probability of the full ultra-bull
        outcome is approximately 1–5%. Against a ~10<sup>4</sup> asymmetry,
        expected value sits in the 10&times;–50&times; range. This is asymmetric
        in the rationally interesting direction, but it is correctly sized as a
        small allocation, not a primary thesis.
      </P>
      <PQ>
        Internal coherence is a property of all well-constructed false beliefs,
        not just true ones. Size against the probability, not the elegance.
      </PQ>
      <P>
        The failure mode against which the strongest warning applies is the
        substitution of internal narrative beauty for base-rate reasoning. The
        narrative developed in this paper is internally coherent. Internal
        coherence is a property of all well-constructed false beliefs as well as
        true ones. The position should be sized against the probability range
        above, not against the elegance of the framing.
      </P>
    </section>
  );
}
function S9() {
  return (
    <section>
      <SH n={9}>What to do next</SH>
      <BL>
        Three reader types, three concrete first moves. Pick the one that
        matches your situation.
      </BL>

      <div className="mt-6 space-y-4">
        <RB>
          <p className="mb-2 text-lg font-bold text-brand-glow">
            Bitcoin holder{" "}
            <span className="text-sm font-normal italic text-slate-400">
              Insurance against your primary position
            </span>
          </p>
          <p>
            <strong className="text-slate-100">Size:</strong> 0.5–2% of your
            BTC position. Treat as insurance, not as primary thesis.
          </p>
          <p className="mt-1">
            <strong className="text-slate-100">Acquire:</strong> Limit orders
            only, accumulated over weeks. Active venues: NonKYC.io, LBank,
            Bybit, Phemex. All thin; market orders move price.
          </p>
          <p className="mt-1">
            <strong className="text-slate-100">Custody:</strong> Tidecoin Core
            wallet on a node you control. Build verified against{" "}
            <code className="text-xs text-slate-400">guix.sigs</code>.{" "}
            <em>No hardware wallet support exists.</em> Do not store significant
            TDC on exchanges.
          </p>
          <p className="mt-1">
            <strong className="text-slate-100">Probability frame:</strong>{" "}
            1–5% chance of 10&times;–1000&times; outcome. Size against the
            probability, not the elegance.
          </p>
        </RB>

        <RB>
          <p className="mb-2 text-lg font-bold text-brand-glow">
            Developer{" "}
            <span className="text-sm font-normal italic text-slate-400">
              The binding constraint on the entire thesis
            </span>
          </p>
          <p className="font-semibold text-slate-100">
            Highest leverage move available to any reader.
          </p>
          <p className="mt-1">
            <strong className="text-slate-100">Read:</strong> &sect;7. Pick the
            smallest roadmap item that matches your skill set.
          </p>
          <p className="mt-1">
            <strong className="text-slate-100">Submit:</strong> Pull requests to{" "}
            <code className="text-xs text-slate-400">github.com/tidecoin</code>.
            The contributor base is the binding constraint on the entire
            ultra-bull outcome.
          </p>
          <p className="mt-1">
            <strong className="text-slate-100">
              Why this matters more than buying:
            </strong>{" "}
            A single competent maintainer who commits to the project meaningfully
            shifts the joint probability of the ultra-bull outcome (specifically,
            lowers risks 4 and 5 in &sect;8). Buying does not. Contributing
            does.
          </p>
        </RB>

        <RB>
          <p className="mb-2 text-lg font-bold text-brand-glow">
            Analyst{" "}
            <span className="text-sm font-normal italic text-slate-400">
              Adversarial verification
            </span>
          </p>
          <p>
            <strong className="text-slate-100">
              Replicate the verification handles in this paper.
            </strong>{" "}
            Confirm the Foundation org&apos;s existence and activity. Confirm
            there is no foundation treasury, no premine wallet, no governance
            token. Diff{" "}
            <code className="text-xs text-slate-400">tidecoin/tidecoin</code>{" "}
            against{" "}
            <code className="text-xs text-slate-400">
              tidecoin-old/tidecoin
            </code>{" "}
            for the active modernization frontier. Verify BIP-360 still includes
            Falcon as a candidate.
          </p>
          <p className="mt-1">
            <strong className="text-slate-100">Publish:</strong> Confirmations{" "}
            <em>and</em> disconfirmations. The thesis benefits from skeptical
            scrutiny; credulous adoption is the failure mode.
          </p>
        </RB>
      </div>

      <P>
        The question this paper has tried to answer is whether the structural
        thesis is real. The question it leaves to the reader is whether they
        wish to participate in determining whether the trajectory continues.
      </P>
    </section>
  );
}
function Refs() {
  return (
    <section className="mt-16">
      <hr className="border-slate-700" />
      <p className="mt-6 text-xs italic text-slate-500">
        <strong className="not-italic text-slate-400">
          Methodology and limitations.
        </strong>{" "}
        This is a working paper; it has been iteratively improved over multiple
        drafts as the author&apos;s view of the topology has improved. The
        structural arguments (cascade, three configurations, asymmetry, hedge)
        are stable across all drafts. The technical and empirical arguments have
        been revised as new evidence has accumulated, most recently to integrate
        BIP-360, the Lopp–Papathanasiou sunset proposal, and verified
        market-capitalization figures. Data and code references are current as
        of the date on the title page; market capitalization, exchange
        availability, and repository state are subject to change. Readers
        verifying claims should use the verification boxes adjacent to the
        relevant claims rather than relying on the prose. This document is
        released under CC BY 4.0; redistribution and adaptation are encouraged.
      </p>

      <p className="mt-6 text-sm font-semibold text-brand-glow">
        References and verification sources
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Shor 1994, <em>FOCS</em> &bull; Mosca 2018,{" "}
        <em>IEEE Sec. &amp; Privacy</em> 16(5) &bull; Roetteler et al. 2017,{" "}
        <em>ASIACRYPT</em> &bull; Chevignard, Fouque &amp; Schrottenloher 2026,{" "}
        <em>EUROCRYPT</em> &bull; NIST FIPS 203/204/205, August 2024 &bull;
        Ducas et al., <em>Falcon</em> NIST submission 2018 &bull; Beast,
        Heilman &amp; Foxen Duke, <em>BIP-360 (P2QRH)</em>,{" "}
        <code>bip360.org</code> &bull; Lopp &amp; Papathanasiou,{" "}
        <em>Post-Quantum Migration and Legacy Signature Sunset</em>,{" "}
        <code>qbip.org</code>, July 2025 &bull;{" "}
        <em>Hybrid Post-Quantum Signatures for Bitcoin and Ethereum</em>, JBBA
        2025 &bull; Bitcoin Optech, <em>Quantum resistance topic</em>,{" "}
        <code>bitcoinops.org/en/topics/quantum-resistance/</code> &bull;
        EverettX, <em>Tidecoin whitepaper</em>, December 2020 &bull; Nakamoto,{" "}
        <em>Bitcoin whitepaper</em>, 2008 &bull; Peslyak, <em>yespower</em>,
        Openwall 2018 &bull; Tidecoin Foundation,{" "}
        <code>github.com/tidecoin</code> &bull;{" "}
        <code>github.com/tidecoin-old</code> (historical baseline).
      </p>
    </section>
  );
}
