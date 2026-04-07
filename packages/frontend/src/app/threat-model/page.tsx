import type { Metadata } from "next";
import Link from "next/link";
import { Term } from "@/components/Term";

export const metadata: Metadata = {
  title: "Threat model",
  description:
    "The honest three-risk model for Tidecoin. Shor does not apply; implementation bugs, Falcon cryptanalysis, and Grover against Hash160 do. Citations and source line numbers for every claim.",
};

/**
 * Long-form threat model. Verbatim content source:
 * docs/threat-model.md. Editing this page and the md file is
 * discouraged — pick one or the other. Current convention: the
 * page renders the authoritative narrative, docs/threat-model.md
 * mirrors it as a text-only reference for CI / grep audits.
 */
export default function ThreatModelPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header>
        <p className="text-sm uppercase tracking-wider text-brand-glow">Threat model</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">
          Three risks to track. Shor isn&apos;t one of them.
        </h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          prevblock does not claim Tidecoin is unbreakable. It claims to tell you
          exactly what the risks are and where your coins sit against them. This
          page is the long version of the onboarding slide 2 — every claim has a
          source.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          The threat that does not apply
        </h2>
        <h3 className="mt-2 text-xl font-semibold text-slate-100">
          <Term name="shor" />
        </h3>
        <p className="mt-3 text-slate-300">
          Shor&apos;s algorithm is the famous quantum attack on Bitcoin. A
          sufficiently large quantum computer running Shor&apos;s can recover an
          ECDSA private key from a published public key in polynomial time.
          It is the reason post-quantum signature schemes exist.
        </p>
        <p className="mt-3 text-slate-300">
          <b>It does not apply to Tidecoin.</b> There is no ECDSA code path in the
          binary. Every on-chain signature — including the genesis coinbase from
          December 2020 — is <Term name="falcon-512" />. Shor provides no known
          speedup against the NTRU lattice problems Falcon rests on. A{" "}
          <Term name="crqc">CRQC</Term> arriving tomorrow would not, by itself,
          endanger any TDC.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Source:{" "}
          <span className="mono">docs/source-extracts/key.h:17-19</span> — the
          three PQCLEAN_FALCON512 constants fully define{" "}
          <span className="mono">CKey</span> and{" "}
          <span className="mono">CPubKey</span> sizes, with no secp256k1 code
          path retained.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          Risk 1 — highest near-term likelihood
        </h2>
        <h3 className="mt-2 text-xl font-semibold text-slate-100">
          Implementation bugs and <Term name="side-channel">side channels</Term>
        </h3>
        <p className="mt-3 text-slate-300">
          Tidecoin signs transactions using the PQClean Falcon-512 reference
          implementation. That implementation&apos;s Gaussian sampler is built on
          floating-point arithmetic, and floating-point operations have
          observable timing variations on many CPUs.
        </p>
        <p className="mt-3 text-slate-300">
          <b>Concrete prior art:</b> Guerreau, Martinelli, Ricosset &amp; Rossi,{" "}
          <i>
            &quot;The Hidden Parallelepiped is Back Again: Power Analysis Attacks
            on Falcon&quot;
          </i>
          , CHES 2022. The authors recover signing keys from measurements on
          the reference implementation running on an ARM Cortex-M4. Not fault
          injection, not invasive access — a clean side-channel recovery.
        </p>
        <p className="mt-3 text-slate-300">
          <b>Operational implication:</b> signing on a general-purpose CPU
          without constant-time floating-point guarantees is a risk today. Most
          desktops and phones fall into that category. Hardware wallets need a
          masked integer-only sampler or a certified constant-time FP unit —
          no shipped consumer wallet advertises that yet.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          Risk 2 — medium horizon
        </h2>
        <h3 className="mt-2 text-xl font-semibold text-slate-100">
          Cryptanalysis of Falcon itself
        </h3>
        <p className="mt-3 text-slate-300">
          <Term name="lattice-cryptography">Lattice cryptanalysis</Term> is an
          active research area. <Term name="falcon-512" /> is NIST level 1
          (~AES-128 classical and quantum), which gives a conservative margin
          today but is not the sort of margin one can leave unmonitored for
          twenty years. Recent improvements in BKZ-style reduction have shaved
          bits off several lattice schemes without breaking them; structured
          lattices like <Term name="ntru" /> attract attacks that exploit the
          ring structure specifically.
        </p>
        <p className="mt-3 text-slate-300">
          <b>Why this is why <Term name="hash-protected" /> matters.</b>{" "}
          If Falcon&apos;s security margin erodes over the chain&apos;s lifetime,
          the Hash160 barrier still keeps hash-protected coins safe — the
          attacker would have to break both the hash and Falcon.{" "}
          <Term name="pubkey-exposed" /> coins have no such insurance.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          Risk 3 — longest horizon
        </h2>
        <h3 className="mt-2 text-xl font-semibold text-slate-100">
          <Term name="grover" /> vs the address hash
        </h3>
        <p className="mt-3 text-slate-300">
          Grover&apos;s algorithm gives a quadratic speedup to black-box search,
          which applies to pre-image attacks on cryptographic hashes. Against
          Tidecoin&apos;s <Term name="hash160">Hash160</Term>:
        </p>
        <ul className="mt-3 space-y-1 text-sm text-slate-300">
          <li>
            Classical pre-image work: <span className="mono">~2^160</span>
          </li>
          <li>
            Grover-accelerated work: <span className="mono">~2^80</span>
          </li>
        </ul>
        <p className="mt-3 text-slate-300">
          2^80 is roughly a billion times the largest classical hashing campaign
          ever done. It is not a near-term concern. We track it because defence
          in depth is cheap: if Falcon itself is later weakened, the hash layer
          remains a meaningful barrier. Hash-protected coins get both layers;
          exposed coins have one.
        </p>
      </section>

      <section className="mt-16 rounded-lg border border-surface-3 bg-surface-1 p-6">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">
          What prevblock does NOT claim
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li>
            That Tidecoin is &quot;quantum-proof.&quot; The word is avoided
            throughout. The correct phrase is &quot;post-quantum by
            construction&quot; with an explicit acknowledgement of residual
            risks.
          </li>
          <li>That Falcon has been formally verified end-to-end. It has not.</li>
          <li>
            That these three risks are the only risks. They are the three that
            are public today and backed by published research. More may
            emerge; monitoring this page is part of the operator&apos;s job.
          </li>
        </ul>
      </section>

      <nav className="mt-12 text-sm">
        <Link href="/glossary">Glossary</Link>
        <span className="mx-3 text-slate-600">·</span>
        <Link href="/">Dashboard</Link>
      </nav>
    </main>
  );
}
