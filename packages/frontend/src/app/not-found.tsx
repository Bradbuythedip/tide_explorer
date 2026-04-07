import Link from "next/link";

/**
 * Global Next.js 404 page.
 *
 * Next doesn't pass the original URL or search query into this page
 * by design (it's static-rendered), so we can only render a generic
 * "you took a wrong turn" message here.
 *
 * The interesting diagnostic path — the one DIRECTIVE.md §2.3
 * actually targets — is when the user SEARCHES for something that
 * doesn't exist (bad txid, wrong address prefix, etc). That flow
 * lives in the per-route not-found.tsx files (block/not-found,
 * tx/not-found, address/not-found) and in the search page itself,
 * which all read the query from the URL and call classifyInput().
 */
export default function GlobalNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="text-sm uppercase tracking-wider text-brand-glow">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-100">
        This page doesn&apos;t exist on prevblock.
      </h1>
      <p className="mt-4 text-slate-400">
        If you were searching for something — a block, a transaction, or an
        address — use the search bar and prevblock will tell you exactly
        what&apos;s wrong with your input.
      </p>
      <div className="mt-8 flex justify-center gap-4 text-sm">
        <Link href="/">Dashboard</Link>
        <Link href="/glossary">Glossary</Link>
        <Link href="/threat-model">Threat model</Link>
      </div>
    </main>
  );
}
