#!/bin/bash
# Stops and removes the background job set up by install-instagram-sync.sh. Leaves the files already saved to Drive, the
# state file (~/.cache/insidegov-instagram-sync.json) and the private checkout (~/.insidegov-instagram-sync) alone.
set -euo pipefail
LABEL=fyi.insidegov.instagram-sync
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "removed $LABEL"
