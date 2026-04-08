"use client";

/**
 * Next.js error boundary for /richlist.
 *
 * Replaces Next's default 'Application error: a server-side
 * exception has occurred' message with something that tells the
 * user what actually happened and gives them a way out. The
 * generic default is catastrophically unhelpful — someone lands
 * on the page, sees a red box with a 'Digest' hash, and has no
 * idea whether the site is broken forever or if a refresh will
 * fix it.
 *
 * This component fires whenever the server-rendered richlist page
 * throws an unhandled exception (Zod parse fail, BigInt(undefined),
 * network timeout, etc). Refreshing usually fixes transient
 * issues; the 'try dashboard' link is the escape hatch when it
 * doesn't.
 */

import Link from "next/link";
import { useEffect } from "react";

export default function RichlistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[richlist] render error", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-sm uppercase tracking-wider text-brand-glow">
        Richlist temporarily unavailable
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-100">
        Something went wrong rendering the richlist.
      </h1>
      <p className="mt-4 text-slate-400">
        This is usually transient — the indexer or backend may be in the
        middle of a deploy, or the response shape changed while the
        frontend was still mid-request. Try again in a few seconds.
      </p>

      {error.digest && (
        <p className="mt-4 text-xs text-slate-600">
          Error digest: <span className="mono">{error.digest}</span>
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-brand px-4 py-2 font-medium text-white hover:bg-brand-dim"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-surface-3 px-4 py-2 text-slate-300 hover:border-brand-glow hover:text-slate-100"
        >
          ← Dashboard
        </Link>
      </div>
    </main>
  );
}
