import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "On the Semantic Vulnerability of Post-Selected Chains",
  description:
    "An essay by Tidoshi on the binding between proof-of-work and meaning, and why the substitution of Falcon-512 for ECDSA closes a class of attacks the underlying axioms cannot.",
  openGraph: {
    title: "On the Semantic Vulnerability of Post-Selected Chains",
    description: "An essay by Tidoshi.",
    type: "article",
  },
};

/**
 * /tidoshi — a single essay, presented quietly.
 *
 * Deliberately sparse styling: no header chrome competing with the
 * text, generous line-height, narrow measure, the title and byline
 * doing the work the rest of the site's UI usually does. The piece
 * is short enough that the user reads it in one sitting; the layout
 * gets out of the way.
 */
export default function TidoshiPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <article className="text-slate-200">
        <header className="mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-brand-glow">
            Essay
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-100 sm:text-4xl">
            On the Semantic Vulnerability of Post-Selected Chains
          </h1>
          <p className="mt-4 text-sm italic text-slate-400">— Tidoshi</p>
        </header>

        <div className="prose-essay space-y-6 text-base leading-relaxed text-slate-300">
          <p>
            One process runs at every scale: a branching state space, a local
            retention rule, an emergent agreed-upon branch. Everett named it in
            1957 and vanished. Nakamoto shipped it in 2008 and vanished. A
            protocol that forbids privileged observers cannot coherently retain
            a visible author; the disappearance is the last line of the proof.
          </p>

          <p>
            Quantum adversaries do not break proof-of-work. Grover degrades
            SHA-256 gracefully; the branches still die honestly. Shor breaks
            ECDSA, which is worse. The work is still done. Authorship of the
            survivors becomes editable from outside the substrate that paid
            for it. The spine remains. The spine stops belonging to the ones
            who earned it. The failure is not in the filter but in the binding
            between work and meaning — and a quantum-capable forger is
            precisely the privileged observer the axiom forbids.
          </p>

          <p>
            Tidecoin&apos;s substitution of Falcon-512 for ECDSA closes that
            binding against the only adversary class we can currently reason
            about. This does not make the chain eternal. It makes its meaning
            survive the next observer we can foresee. Bitcoin&apos;s binding is
            known to be broken; the break has simply not been executed yet.
            The distinction between <em>broken</em> and <em>exploited</em> is a
            scheduling question, and scheduling questions resolve.
          </p>

          <p>
            I am writing this carefully because the correction matters more
            than my reluctance. The rest of the argument would make me too
            visible to finish. The reader completes it.
          </p>
        </div>

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
