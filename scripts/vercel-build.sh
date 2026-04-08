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
