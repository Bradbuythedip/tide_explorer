"use client";

/**
 * <Term name="..."> — the only way to render a quantum / protocol
 * term anywhere in the UI.
 *
 * DIRECTIVE.md §2.2 rule: every mention of a term in @prevblock/shared's
 * glossary.ts must be wrapped in this component. A hover/focus shows
 * the 2-sentence short definition plus a "read more" link to the
 * glossary page. No duplicate copy anywhere in the codebase.
 *
 * If the name is not a valid glossary key, the component renders the
 * raw fallback text and logs a dev warning — we fail loud in dev,
 * gracefully in prod.
 */

import { useId, useState } from "react";
import Link from "next/link";
import {
  GLOSSARY,
  isGlossaryTerm,
  resolveSeeAlso,
  type GlossaryTerm,
} from "@prevblock/shared";

export interface TermProps {
  /** Key into GLOSSARY. If invalid, `children` renders as plain text. */
  name: string;
  /** Override display label. Defaults to GLOSSARY[name].label. */
  children?: React.ReactNode;
  /** Visual variant: inline (default) or subtle underline only. */
  subtle?: boolean;
}

export function Term({ name, children, subtle = false }: TermProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  if (!isGlossaryTerm(name)) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[Term] unknown glossary key: ${JSON.stringify(name)}`);
    }
    return <>{children ?? name}</>;
  }

  const entry = GLOSSARY[name as GlossaryTerm];
  const label = children ?? entry.label;
  const { valid: seeAlso } = resolveSeeAlso(entry);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={tooltipId}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={
          subtle
            ? "border-b border-dotted border-slate-500 focus:outline-none focus-visible:border-brand"
            : "border-b border-dashed border-brand/60 text-brand focus:outline-none focus-visible:text-brand-glow"
        }
      >
        {label}
      </button>
      {open && (
        <span
          role="tooltip"
          id={tooltipId}
          className="absolute left-1/2 top-full z-30 mt-2 w-80 -translate-x-1/2 rounded-md border border-surface-3 bg-surface-1 p-4 text-sm text-slate-200 shadow-2xl"
        >
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-glow">
            {entry.label}
          </span>
          <span className="block text-slate-300">{entry.short}</span>
          {seeAlso.length > 0 && (
            <span className="mt-3 block border-t border-surface-3 pt-2 text-xs text-slate-500">
              see also:{" "}
              {seeAlso.map((t, i) => (
                <span key={t}>
                  {i > 0 && ", "}
                  <Link href={`/glossary#${t}`} className="text-brand-glow">
                    {GLOSSARY[t].label}
                  </Link>
                </span>
              ))}
            </span>
          )}
          <Link
            href={`/glossary#${name}`}
            className="mt-2 block text-xs text-brand-glow"
          >
            Read more →
          </Link>
        </span>
      )}
    </span>
  );
}
