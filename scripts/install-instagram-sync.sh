#!/bin/bash
# Sets up the background job that saves each approved social draft's Instagram slides into Google Drive, so there is
# nothing to run by hand. Run it once, on the Mac that has Google Drive for desktop, from a checkout of this repo on main:
#
#   scripts/install-instagram-sync.sh
#
# It makes a private checkout of main at ~/.insidegov-instagram-sync (so the job never depends on a branch you are
# working on), installs its packages, and registers a launchd agent that runs scripts/instagram-sync.sh at login and every
# five minutes. Needs `gh` signed in, node and pnpm. Log: ~/Library/Logs/insidegov-instagram-sync.log.
# Remove it with scripts/uninstall-instagram-sync.sh.
set -euo pipefail

LABEL=fyi.insidegov.instagram-sync
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$HOME/.insidegov-instagram-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/insidegov-instagram-sync.log"

for tool in gh node pnpm git; do command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 1; }; done
gh auth status >/dev/null 2>&1 || { echo "gh is not signed in: run 'gh auth login'" >&2; exit 1; }
ls -d "$HOME"/Library/CloudStorage/GoogleDrive-* >/dev/null 2>&1 || echo "note: no Google Drive folder yet; files will go to ~/Downloads/InsideGov Instagram until Drive for desktop is signed in"

git -C "$SRC" fetch -q origin main
if [ ! -d "$DIR" ]; then
  git -C "$SRC" worktree add --detach "$DIR" origin/main
fi
[ -x "$DIR/scripts/instagram-sync.sh" ] || { echo "the sync script is not on main yet: merge it first" >&2; exit 1; }
(cd "$DIR" && git checkout -q --detach origin/main && pnpm install --frozen-lockfile --silent)

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$DIR/scripts/instagram-sync.sh</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$PATH</string></dict>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>300</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed: approved drafts are saved to Google Drive within about five minutes (log: $LOG)"
