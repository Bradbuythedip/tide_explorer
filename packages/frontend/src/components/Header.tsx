import Link from "next/link";
import { SearchBar } from "./SearchBar";

/**
 * Persistent header rendered on every page via layout.tsx.
 *
 * Three responsibilities:
 *   1. Brand mark (links home).
 *   2. SearchBar — DIRECTIVE.md §2.6 makes the search input the
 *      single primary navigation surface, so it lives at the top of
 *      every page, not just the dashboard.
 *   3. The five top-level nav targets.
 */
export function Header() {
  return (
    <header className="border-b border-surface-2 bg-surface-0/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3 text-xl font-semibold tracking-tight text-slate-100 hover:text-brand-glow"
        >
          <img
            src="/tidecoin-coin.svg"
            alt=""
            width={36}
            height={36}
            className="shrink-0"
          />
          <span>
            prev<span className="text-brand">block</span>
          </span>
        </Link>
        <div className="lg:flex-1 lg:px-6">
          <SearchBar />
        </div>
        <nav className="flex shrink-0 flex-wrap gap-4 text-sm">
          <Link href="/genesis">Genesis</Link>
          <Link href="/holdem" className="text-brand-glow">
            Tide Hold&apos;em
          </Link>
          <Link href="/richlist">Richlist</Link>
          <Link href="/tidoshi" className="text-brand-glow">
            Tidoshi
          </Link>
          <Link href="/glossary">Glossary</Link>
        </nav>
      </div>
    </header>
  );
}
