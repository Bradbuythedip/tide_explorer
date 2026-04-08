#!/usr/bin/env bash
#
# Vercel build script — QUIET mode.
#
# Redirects verbose pnpm/tsc/next output to per-phase log files.
# On success, prints only the phase markers — ~15 lines total,
# fits in any reasonable log viewer without scrolling.
# On failure, dumps the tail of the failing phase's log so the
# error is visible without scrolling either.

set -u

SHARED_LOG=/tmp/prevblock-shared-build.log
FRONTEND_LOG=/tmp/prevblock-frontend-build.log

echo "===[1/4] START==="

# Clear stale incremental tsc caches and dist dirs so Vercel's
# restored build cache can't poison the build.
rm -f packages/shared/tsconfig.tsbuildinfo \
      packages/rpc-client/tsconfig.tsbuildinfo \
      packages/backend/tsconfig.tsbuildinfo \
      packages/indexer/tsconfig.tsbuildinfo \
      packages/frontend/tsconfig.tsbuildinfo 2>/dev/null || true
rm -rf packages/shared/dist packages/rpc-client/dist 2>/dev/null || true

echo "===[2/4] building @prevblock/shared (output -> $SHARED_LOG)==="
if npx --yes pnpm@9.12.0 --filter @prevblock/shared build > "$SHARED_LOG" 2>&1; then
  echo "===shared OK==="
  # Print just the last few lines on success so we can confirm tsc ran
  tail -5 "$SHARED_LOG" 2>/dev/null || true
else
  SHARED_EXIT=$?
  echo "===SHARED BUILD FAILED (exit=$SHARED_EXIT)==="
  echo "--- last 80 lines of $SHARED_LOG ---"
  tail -80 "$SHARED_LOG" 2>/dev/null || echo "(log file missing)"
  echo "--- end of shared log ---"
  exit $SHARED_EXIT
fi

echo "===[3/4] building @prevblock/frontend (output -> $FRONTEND_LOG)==="
if npx --yes pnpm@9.12.0 -C packages/frontend run build > "$FRONTEND_LOG" 2>&1; then
  echo "===frontend OK==="
  # Print the Next.js route summary (last ~25 lines of a successful next build)
  tail -30 "$FRONTEND_LOG" 2>/dev/null || true
else
  FRONTEND_EXIT=$?
  echo "===FRONTEND BUILD FAILED (exit=$FRONTEND_EXIT)==="
  echo "--- last 100 lines of $FRONTEND_LOG ---"
  tail -100 "$FRONTEND_LOG" 2>/dev/null || echo "(log file missing)"
  echo "--- end of frontend log ---"
  exit $FRONTEND_EXIT
fi

echo "===[4/4] DONE==="
ls -la packages/frontend/.next 2>/dev/null | head -5 || echo "WARN: .next dir missing"
echo "===build script complete==="
