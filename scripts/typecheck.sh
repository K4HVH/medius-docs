#!/usr/bin/env bash
# Excludes node_modules instead of listing our own directories: the first version listed them and missed
# the two type errors in tests/, which were outside that list from the day it was written. The bun and
# vite type packages disagree about import.meta and hot; that noise isn't this project's and can't be
# fixed here.
set -uo pipefail
cd "$(dirname "$0")/.."
# Checked first, because a pipe into grep swallows the exit status: a missing toolchain would otherwise
# report "clean" and pass the whole gate. tsc's exit code can't stand in for this check: the vendored
# type packages always disagree, so it is always non-zero.
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
