#!/usr/bin/env bash
# Excludes node_modules rather than listing our own directories: the first version listed them, and
# the two type errors sitting in tests/ were outside that list from the day it was written. The bun
# and vite type packages disagree with each other about import.meta and hot, which is noise this
# project did not cause and cannot fix.
set -uo pipefail
cd "$(dirname "$0")/.."
# Proved first, because a pipeline into grep swallows the status: a missing toolchain otherwise
# reports "clean" and satisfies the whole gate. tsc's own exit code cannot stand in for this, since
# it is non-zero whenever the vendored type packages disagree, which is always.
if ! npx tsc --version >/dev/null 2>&1; then
    echo "typecheck: tsc will not run; is node_modules installed?"
    exit 1
fi
out=$(npx tsc --noEmit -p tsconfig.json 2>&1 |
      grep -v '^node_modules/' |
      grep -E '^[^ ].*\([0-9]+,[0-9]+\): error' || true)
[ -z "$out" ] && { echo "typecheck: clean"; exit 0; }
echo "$out"
exit 1
