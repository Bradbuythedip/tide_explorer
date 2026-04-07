# Phase 0 amendment retro — for the directive author (satoshiv2)

> This retro is for you, not for the implementer. It exists so the next
> directive you write doesn't repeat the pattern of confidently inventing
> chain details from generic Bitcoin-fork intuition.

The first draft of `DIRECTIVE.md` contained five factual errors about
Tidecoin's chain. Each one was a case of *asserting* something without a
chain source when you should have *flagged* it as uncertain. The pattern
is the same in all five.

## The five errors

| # | What the draft said | What's actually true | What I should have written instead |
|---|---|---|---|
| 1 | "Tidecoin addresses start with `tdc1q…`" | Bech32 HRP is `tbc`; native segwit is `tbc1q…`; observed mainnet outputs are almost exclusively P2SH `T…`. Source: `chainparams.cpp:135`. | "Tidecoin addresses look like `<verify HRP from chainparams>`. I believe the HRP is `tdc` but I have not checked — Phase 0 must confirm before this string is baked into any validator." |
| 2 | "partition coins between ECDSA and Falcon" | There is no ECDSA code path. Every key is Falcon-512. Source: `key.h:17-19`. | "I assume Tidecoin is a dual-stack ECDSA+Falcon chain like a theoretical BIP360 deployment. If Phase 0 finds this is false and the chain is Falcon-only, the entire §1 personal scorecard redesigns around a Falcon-internal partition (hash-protected vs pubkey-exposed). Which one it is materially changes the whole directive." |
| 3 | "Personal action: move ECDSA coins to a `tdc1q…` Falcon address" | There is nothing to migrate from; everything is already Falcon. The real personal action is consolidating pubkey-exposed Falcon UTXOs back into hash-protected outputs. | "Personal action is TBD pending Phase 0 — it depends on whether the chain is dual-stack or Falcon-only. If dual-stack: migrate ECDSA → Falcon. If Falcon-only: re-hide exposed pubkeys. Tooltip copy must be written against the ground-truth model, not the template BTC-PQ-fork model." |
| 4 | "Onboarding Slide 2 explains how Shor's algorithm breaks ECDSA" | Shor does not apply on Tidecoin. Telling the user Shor breaks ECDSA on a chain with no ECDSA is teaching a false mental model of the chain they are currently looking at — the exact failure Norman §2 is meant to prevent. | "Slide 2 explains why the quantum story for this specific chain is more subtle than the generic BTC quantum story. Exact content depends on what the chain's threat model actually is — write after Phase 0." |
| 5 | "§6 comparison headline: PQ-secure supply %" | On Tidecoin that number is 100% by construction (same as DIL). The TDC-interesting number is the hash-protected fraction. | "Comparison headline: whichever number is meaningfully different between the three chains. If all three are 100% PQ by construction, find a different headline — don't pretend 0%/100%/100% is interesting." |

## The common pattern

All five errors look different on the surface but share one root cause:

**I built the directive against a template of "generic BTC-fork PQ coin"
and treated that template as if it were Tidecoin-specific knowledge.** The
template has one ECDSA/PQ dual stack, a `<ticker>1q` bech32 prefix, a
Shor-based threat story, and a migration-from-ECDSA narrative. None of
those are Tidecoin. They are the shape of what a Tidecoin *could* have
looked like if it had been designed like BIP360 or a hypothetical Zcash-PQ
bolt-on.

I never asked "which of these are Tidecoin-specific facts I know from a
primary source, and which are template defaults I'm assuming carry over?"

The answer to that question in the first draft was: **zero of the
Tidecoin-specific claims were from primary sources. All of them were
template defaults.** Phase 0 was already sitting on the disk telling me
this, and I still wrote the directive without reading it.

## The fix for next time

Concrete rules I want to follow when writing the next directive:

1. **If a claim about the target chain cannot cite a file in
   `docs/source-extracts/`, `docs/sample-responses/`, or
   `docs/tidecoin-protocol.md`, it is a template default, not a fact.**
   Template defaults in a directive should be prefixed with `ASSUMED:` and
   a note on what would change if the assumption is wrong. Facts should
   cite the source inline.

2. **Any UX copy that embeds a specific technical claim about the chain
   (address format, threat model, migration story) must be written
   against the chain's own conceptual model, not against the template
   BTC one.** If I don't know the chain's conceptual model well enough
   to write the copy, I write a *placeholder* and mark it for Phase 0
   fill-in, instead of writing the template version and shipping it.

3. **Read `PHASE_0_RETRO.md` before writing any directive that touches
   chain-specific claims.** This sounds too obvious to be worth writing
   down, but I wrote the directive draft in the same session that
   produced Phase 0 and still didn't cross-reference it. The rule is:
   open the retro file in a second pane, keep it visible while writing
   the directive, and when the draft is done, diff the directive's
   chain-specific claims against the retro's assumption table.

4. **The test for "is this claim template or fact" is: can I quote a
   specific line number from `docs/source-extracts/`?** If no, it's
   template. This is the same test Claude is supposed to apply to its
   own pretraining. It applies to the directive author too.

5. **The "keystone feature" framing makes factual errors more dangerous,
   not less.** Because everything downstream of §1 rests on the §1
   mental model, a single wrong assumption in §1 propagates through
   every subsequent section. In this draft the wrong ECDSA/Falcon
   partition appeared in §1, §2, §2.1, §2.2, §3, §4, §5, and §6 — every
   section had to be corrected once the root error was found. The
   higher the leverage of a section, the higher the cost of a wrong
   assumption in it, and the more care that section deserves.

## What didn't go wrong

Phase 0 itself did exactly what it was supposed to do. The instinct to
distrust training data on Tidecoin specifics, verify against the chain,
and push back on the v2 spec's wrong assumptions produced the correction
set that made this amendment possible. That discipline cost a few hours
of Phase 0 work and saved the entire Phase A frontend from being built
against a fictional chain. The next directive should lean on Phase 0
harder, not less, and should cite it in every chain-specific paragraph.

---

Written: 2026-04-07.
Commit: applied on top of `607c76a` (corrected DIRECTIVE.md + glossary + threat model).
