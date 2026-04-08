"use client";

/**
 * First-visit onboarding (DIRECTIVE.md §2.1).
 *
 * Three slides — rendered on top of the dashboard as a skippable
 * overlay. Flag persisted in IndexedDB under "ui:onboarding:seen".
 * Any visit after the first is silent unless the user clicks the
 * "Take the tour" link in the footer.
 *
 * Slide 2 is corrected per DIRECTIVE.md §0 amendment #2: Shor is
 * explicitly framed as "does not apply here" and the three residual
 * risks point at /threat-model with citations. The visual is a
 * triangle with those vertices — not a sword-and-shield.
 *
 * The whole flow is client-only. Nothing about the user's state ever
 * leaves the browser.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { kvGet, kvSet } from "@/lib/client-storage";
import { Term } from "./Term";

const KEY = "ui:onboarding:seen";
const VERSION = 1;

interface StoredFlag {
  seen: boolean;
  version: number;
  at: number;
}

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Decide whether to show on mount. We never render the overlay on
  // the server — first render is empty, then IndexedDB reports back.
  useEffect(() => {
    let cancelled = false;
    kvGet<StoredFlag>(KEY).then((flag) => {
      if (cancelled) return;
      setHydrated(true);
      if (!flag || flag.version !== VERSION || !flag.seen) {
        setOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    void kvSet<StoredFlag>(KEY, {
      seen: true,
      version: VERSION,
      at: Date.now(),
    });
  }, []);

  // Re-entry point rendered in the footer; exported via window event.
  useEffect(() => {
    const handler = () => {
      setSlide(0);
      setOpen(true);
    };
    window.addEventListener("prevblock:open-onboarding", handler);
    return () =>
      window.removeEventListener("prevblock:open-onboarding", handler);
  }, []);

  if (!hydrated || !open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/80 p-6 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-2xl rounded-xl border border-surface-3 bg-surface-1 p-10 shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 text-xs text-slate-500 hover:text-slate-300"
          aria-label="Skip tour"
        >
          Skip
        </button>

        {slide === 0 && <SlideOne />}
        {slide === 1 && <SlideTwo />}
        {slide === 2 && <SlideThree />}

        <nav className="mt-10 flex items-center justify-between">
          <div className="flex gap-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={
                  i === slide
                    ? "h-2 w-8 rounded-full bg-brand"
                    : "h-2 w-2 rounded-full bg-surface-3"
                }
              />
            ))}
          </div>
          <div className="flex gap-3">
            {slide > 0 && (
              <button
                type="button"
                onClick={() => setSlide(slide - 1)}
                className="rounded-md px-4 py-2 text-sm text-slate-400 hover:text-slate-100"
              >
                Back
              </button>
            )}
            {slide < 2 ? (
              <button
                type="button"
                onClick={() => setSlide(slide + 1)}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dim"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={dismiss}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dim"
              >
                Got it
              </button>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}

/** Called from the footer link "Take the tour" to re-open at slide 1. */
export function openOnboarding() {
  window.dispatchEvent(new Event("prevblock:open-onboarding"));
}

function SlideOne() {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-brand-glow">
        What is Tidecoin?
      </p>
      <h2 id="onboarding-title" className="mt-2 text-3xl font-semibold text-slate-100">
        A Bitcoin fork where every signature is post-quantum.
      </h2>
      <p className="mt-6 text-slate-300">
        Tidecoin is a Bitcoin Core 0.18 fork that replaces ECDSA with{" "}
        <Term name="falcon-512" />, a lattice-based signature scheme. Every key on
        the chain — including the genesis coinbase from December 2020 — is
        Falcon. There is no ECDSA code path anywhere in the binary.
      </p>
      <p className="mt-4 text-sm text-slate-500">
        Blocks are one minute apart. Current supply is ~18.8 million TDC out of a
        21 million cap.
      </p>
    </div>
  );
}

function SlideTwo() {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-brand-glow">
        What quantum actually means here
      </p>
      <h2 className="mt-2 text-3xl font-semibold text-slate-100">
        Shor doesn't apply. Three other things do.
      </h2>
      <p className="mt-5 text-slate-300">
        <Term name="shor" /> — the famous quantum attack on Bitcoin's ECDSA — does
        not apply to Tidecoin. Every on-chain signature is already{" "}
        <Term name="falcon-512" />, which is lattice-based, not discrete-log-based.
        There is nothing on the chain for Shor to break.
      </p>
      <p className="mt-4 text-slate-300">
        What does apply: three residual risks, none urgent today, all worth
        watching.
      </p>
      <ul className="mt-4 space-y-2 text-sm text-slate-300">
        <li>
          <span className="text-threat-bare">●</span>{" "}
          <b>Implementation bugs and <Term name="side-channel">side channels</Term>.</b>{" "}
          The biggest real-world risk today. Reference Falcon has published
          power-analysis attacks on its Gaussian sampler.
        </li>
        <li>
          <span className="text-threat-exposed">●</span>{" "}
          <b>Cryptanalysis of Falcon itself.</b> No break exists. Active research
          area; this is the reason keeping an upgrade path open matters.
        </li>
        <li>
          <span className="text-threat-safe">●</span>{" "}
          <b><Term name="grover">Grover</Term> vs the address hash.</b> Reduces
          effective security on a <Term name="hash-protected" /> address from ~256
          bits to ~128 bits. Still infeasible.
        </li>
      </ul>
      <p className="mt-5 text-sm text-slate-500">
        Full version with citations:{" "}
        <Link href="/threat-model" className="underline">
          /threat-model
        </Link>
        .
      </p>
    </div>
  );
}

function SlideThree() {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-brand-glow">
        What prevblock shows you
      </p>
      <h2 className="mt-2 text-3xl font-semibold text-slate-100">
        Visibility into which of your coins are behind which layer.
      </h2>
      <p className="mt-5 text-slate-300">
        Every output on Tidecoin falls into one of three buckets:
      </p>
      <ul className="mt-4 space-y-3 text-sm text-slate-300">
        <li>
          <span className="text-threat-safe">■</span>{" "}
          <Term name="hash-protected" /> — the public key is still hidden behind a
          Hash160. Both layers of protection intact.
        </li>
        <li>
          <span className="text-threat-exposed">■</span>{" "}
          <Term name="pubkey-exposed" /> — the address was spent from, so the
          Falcon pubkey is now on chain. One layer of protection remains.
        </li>
        <li>
          <span className="text-threat-bare">■</span>{" "}
          <Term name="bare-p2pk" /> — the pubkey was on chain from the moment the
          output was created (e.g. the genesis coinbase).
        </li>
      </ul>
      <p className="mt-5 text-slate-300">
        prevblock shows every address&apos;s balance broken down into these
        three buckets so you can see at a glance how exposed your coins are.
      </p>
    </div>
  );
}
