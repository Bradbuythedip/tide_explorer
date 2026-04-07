import Link from "next/link";
import { redirect } from "next/navigation";
import { classifyInput } from "@/lib/classify-input";

/**
 * /search?q=... — the only entry point that runs the input classifier
 * at server-side.
 *
 * Behaviour:
 *   - empty q → bounce to home
 *   - valid q → immediate redirect to toHref (no intermediate page)
 *   - invalid q → render a diagnostic page explaining what's wrong
 *     and what a valid input looks like. This is the
 *     DIRECTIVE.md §2.3 target: "diagnose, not shrug."
 */
export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const raw = searchParams.q ?? "";

  if (raw.trim() === "") {
    redirect("/");
  }

  const result = classifyInput(raw);

  if (result.valid && result.toHref) {
    redirect(result.toHref);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <p className="text-sm uppercase tracking-wider text-brand-glow">Not found</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-100">
        prevblock couldn&apos;t match that query.
      </h1>

      <div className="mt-8 rounded-lg border border-surface-3 bg-surface-1 p-5">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          you searched for
        </div>
        <div className="mono mt-2 break-all text-slate-100">{raw}</div>
      </div>

      <div className="mt-6 rounded-lg border border-threat-bare/30 bg-threat-bare/5 p-5 text-sm">
        <div className="text-threat-bare">why it didn&apos;t resolve</div>
        <p className="mt-2 text-slate-200">{result.reason}.</p>
        {result.hint && (
          <p className="mt-2 text-slate-400">{result.hint}.</p>
        )}
      </div>

      <div className="mt-8 text-sm text-slate-400">
        <p className="font-medium text-slate-300">What prevblock accepts</p>
        <ul className="mt-3 space-y-2">
          <li>
            <span className="mono text-slate-200">0</span>,{" "}
            <span className="mono text-slate-200">1</span>,{" "}
            <span className="mono text-slate-200">2503300</span> — block height
          </li>
          <li>
            <span className="mono text-slate-200">
              480ecc7602d8989f32483377ed66381c391dda6215aeef9e80486a7fd3018075
            </span>{" "}
            — 64-char lowercase hex txid or block hash
          </li>
          <li>
            <span className="mono text-slate-200">tbc1q…</span>, {" "}
            <span className="mono text-slate-200">T…</span>,{" "}
            <span className="mono text-slate-200">V…</span>,{" "}
            <span className="mono text-slate-200">F…</span> — Tidecoin address
          </li>
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Note: Tidecoin bech32 addresses use the prefix <span className="mono">tbc1</span>,
          not <span className="mono">tdc1</span>. That&apos;s a common confusion — the
          draft spec even got it wrong. See{" "}
          <Link href="/glossary#p2wpkh-falcon">glossary</Link>.
        </p>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/">← Dashboard</Link>
      </p>
    </main>
  );
}
