#!/usr/bin/env bash
#
# Vercel build script with loud phase markers.
#
# Invoked by vercel.json's buildCommand. The echo markers make it
# impossible to miss which phase died, because the last '===' line
# before 'exited with 1' in Vercel's log tells us exactly where.
#
# Also captures and prints each step's exit code explicitly, so we
# don't just see Vercel's generic 'Command ... exited with 1'
# envelope — we see which sub-step actually failed.

set -u  # error on unset vars, but NOT -e so we control the exit flow

echo "===[1/4] START==="

# Clear any stale incremental tsc cache that Vercel may have restored
# from a previous deployment. A stale .tsbuildinfo can cause tsc to
# skip re-emitting files or hang on type resolution, especially when
# the source tree has changed since the cache was taken.
echo "=== clearing stale .tsbuildinfo files ==="
rm -f packages/shared/tsconfig.tsbuildinfo || true
rm -f packages/rpc-client/tsconfig.tsbuildinfo || true
rm -f packages/backend/tsconfig.tsbuildinfo || true
rm -f packages/indexer/tsconfig.tsbuildinfo || true
rm -f packages/frontend/tsconfig.tsbuildinfo || true
rm -rf packages/shared/dist || true
rm -rf packages/rpc-client/dist || true
echo "=== cache cleared ==="

echo "===[2/4] building @prevblock/shared==="
npx --yes pnpm@9.12.0 --filter @prevblock/shared build 2>&1
SHARED_EXIT=$?
echo "===shared exit=$SHARED_EXIT==="
if [ $SHARED_EXIT -ne 0 ]; then
  echo "FAIL: shared build exited with $SHARED_EXIT"
  exit $SHARED_EXIT
fi

echo "===[3/4] building @prevblock/frontend==="
npx --yes pnpm@9.12.0 -C packages/frontend run build 2>&1
FRONTEND_EXIT=$?
echo "===frontend exit=$FRONTEND_EXIT==="
if [ $FRONTEND_EXIT -ne 0 ]; then
  echo "FAIL: frontend build exited with $FRONTEND_EXIT"
  exit $FRONTEND_EXIT
fi

echo "===[4/4] DONE==="
ls -la packages/frontend/.next || echo "WARN: .next directory missing"
echo "===build script complete==="
