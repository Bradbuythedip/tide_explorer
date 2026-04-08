"use client";

/**
 * The only search UI on the site.
 *
 * DIRECTIVE.md §2.6: reject obviously-malformed input BEFORE
 * submission and show the user what's wrong in-line. On valid input
 * it routes via the /search page, which in turn redirects to
 * /block/:id, /tx/:id, or /address/:addr.
 *
 * The classifier lives in lib/classify-input.ts and is reused by
 * the /search page so there's exactly one definition of what
 * "valid" means.
 */

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { classifyInput } from "@/lib/classify-input";

export function SearchBar() {
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const showFeedback = touched && trimmed.length > 0;
  const result = showFeedback ? classifyInput(trimmed) : null;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (trimmed.length === 0) return;
    const classified = classifyInput(trimmed);
    if (classified.valid && classified.toHref) {
      router.push(classified.toHref);
      return;
    }
    // Fall through to the search page for the diagnostic view.
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  const invalid = showFeedback && result !== null && !result.valid;

  return (
    <form onSubmit={onSubmit} className="w-full" role="search">
      <label htmlFor={inputId} className="sr-only">
        Search block height, txid, or address
      </label>
      <div
        className={
          "flex items-center gap-2 rounded-lg border bg-surface-1 px-4 py-3 transition-colors " +
          (invalid
            ? "border-threat-bare"
            : "border-surface-3 focus-within:border-brand")
        }
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-500"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="Height, txid, or address…"
          className="mono min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={invalid || undefined}
          aria-describedby={hintId}
        />
      </div>
      <p
        id={hintId}
        className={
          "mt-2 text-xs " +
          (invalid
            ? "text-threat-bare"
            : "text-slate-500")
        }
      >
        {invalid && result !== null
          ? `${capitalise(result.reason)}.${result.hint ? " " + capitalise(result.hint) + "." : ""}`
          : "Enter a block height, a 64-char txid, or an address starting with tbc1, T, F, or V."}
      </p>
    </form>
  );
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
