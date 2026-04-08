"use client";

import Link from "next/link";
import { openOnboarding } from "./Onboarding";

/**
 * Persistent footer. Renders on every page via layout.tsx.
 *
 * Exposes the "Take the tour" link the onboarding overlay points at
 * from its skip button — DIRECTIVE.md §2.1 requires the overlay to
 * stay reachable any time.
 */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-surface-2 px-6 py-8 text-xs text-slate-600">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <p>
          prevblock · Tidecoin block explorer · built by prevblock, the
          original Tidecoin creator on bitcointalk ·{" "}
          <button
            type="button"
            onClick={openOnboarding}
            className="text-brand-glow underline decoration-dotted underline-offset-2"
          >
            Take the tour
          </button>
        </p>
        <nav className="flex gap-4">
          <Link href="/glossary">Glossary</Link>
          <a
            href="https://github.com/Bradbuythedip/tide_explorer"
            target="_blank"
            rel="noreferrer noopener"
          >
            Source
          </a>
        </nav>
      </div>
    </footer>
  );
}
