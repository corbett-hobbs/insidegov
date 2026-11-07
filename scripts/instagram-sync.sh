#!/bin/bash
# One round of the Instagram sync (run every five minutes by the launchd job that install-instagram-sync.sh sets up):
# bring this checkout up to date with main, then save any newly approved draft's slides and Instagram text into the
# Google Drive folder. See pipeline/insights/README.md, "Instagram (posted by hand)".
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin main
git checkout -q --detach origin/main
pnpm install --frozen-lockfile --silent
pnpm -s insights:slides -- --approved
