import type { Metadata } from "next";
import Link from "next/link";
import { GLOSSARY, resolveSeeAlso, type GlossaryTerm } from "@prevblock/shared";

export const metadata: Metadata = {
  title: "Glossary",
  description:
    "Every cryptographic and protocol term used anywhere on prevblock, with sources. The single source of truth for what 'hash-protected,' 'Falcon-512,' 'Shor,' and the rest mean on Tidecoin.",
};

export default function GlossaryPage() {
  const terms = Object.keys(GLOSSARY).sort() as GlossaryTerm[];

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <p className="text-sm uppercase tracking-wider text-brand-glow">Glossary</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">
          Every term on the site, sourced
        </h1>
        <p className="mt-3 text-slate-400">
          Every term here is wrapped in a <span className="mono">&lt;Term&gt;</span>{" "}
          component wherever the site mentions it. Every entry cites a source file —
          if a claim on this page has no citation, it is not allowed in the UI.
          See{" "}
          <Link href="/threat-model" className="underline">
            /threat-model
          </Link>{" "}
          for the long-form version.
        </p>
      </header>

      <dl className="space-y-10">
        {terms.map((key) => {
          const entry = GLOSSARY[key];
          const { valid: seeAlso } = resolveSeeAlso(entry);
          return (
            <section key={key} id={key} className="scroll-mt-6">
              <dt className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold text-slate-100">{entry.label}</h2>
                <span className="mono text-xs text-slate-600">#{key}</span>
              </dt>
              <dd className="mt-2 text-slate-300">{entry.short}</dd>
              {entry.long && (
                <dd className="mt-3 text-sm text-slate-400">{entry.long}</dd>
              )}
              {entry.sources.length > 0 && (
                <dd className="mt-3 text-xs text-slate-500">
                  <span className="mr-2 uppercase tracking-wider">sources</span>
                  {entry.sources.map((src, i) => (
                    <span key={src} className="mono">
                      {i > 0 && ", "}
                      {src}
                    </span>
                  ))}
                </dd>
              )}
              {seeAlso.length > 0 && (
                <dd className="mt-2 text-xs text-slate-500">
                  see also:{" "}
                  {seeAlso.map((t, i) => (
                    <span key={t}>
                      {i > 0 && ", "}
                      <Link href={`#${t}`} className="text-brand-glow">
                        {GLOSSARY[t].label}
                      </Link>
                    </span>
                  ))}
                </dd>
              )}
            </section>
          );
        })}
      </dl>
    </main>
  );
}
