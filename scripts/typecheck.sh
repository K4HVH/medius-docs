#!/usr/bin/env bash
# Only src/. The bun and vite type packages disagree with each other about import.meta and hot, which
# is noise this project cannot fix and did not cause.
set -uo pipefail
cd "$(dirname "$0")/.."
out=$(npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E '^(src|server|scripts)/' || true)
[ -z "$out" ] && { echo "typecheck: clean"; exit 0; }
echo "$out"
exit 1
