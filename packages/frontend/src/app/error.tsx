"use client";

/**
 * Root-level error boundary.
 *
 * Catches anything unhandled from a page that doesn't have its own
 * error.tsx (so /block, /tx, /address, /genesis, /quantum, etc. all
 * fall through to this one). Replaces Next's default generic
 * "Application error" with an actionable message + retry + escape
 * hatch home.
 */

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[prevblock] render error", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-sm uppercase tracking-wider text-brand-glow">
        Something went wrong
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-100">
        This page hit an error while rendering.
      </h1>
      <p className="mt-4 text-slate-400">
        Usually transient — the backend or indexer may be mid-deploy, or
        a transient fetch error. Try again in a few seconds. If it keeps
        happening, the dashboard usually works.
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
