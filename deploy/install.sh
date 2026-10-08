#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
missing=''
for binary in node python3 ffmpeg pdftotext claude; do
  if ! command -v "$binary" >/dev/null 2>&1; then missing="$missing $binary"; fi
done
if [ -n "$missing" ]; then
  printf 'Missing:%s\n' "$missing"
  printf 'Install Homebrew tools with: brew install node python ffmpeg poppler\n'
  printf 'Install Claude Code and sign in with the local claude CLI.\n'
  exit 1
fi
mkdir -p "$HOME/doc2vid-data" "$HOME/Library/Logs/doc2vid" "$HOME/.config/doc2vid" "$HOME/Library/LaunchAgents"
chmod 700 "$HOME/.config/doc2vid"
if [ -f "$HOME/.config/doc2vid/server.env" ]; then chmod 600 "$HOME/.config/doc2vid/server.env"; fi
(cd "$ROOT/server" && npm ci)
(cd "$ROOT/template" && npm ci && npx playwright install chromium)
DOC2VID_INSTALL_ROOT="$ROOT" DOC2VID_INSTALL_NODE="$(command -v node)" python3 - <<'PY'
import os
from pathlib import Path
from xml.sax.saxutils import escape
root = Path(os.environ['DOC2VID_INSTALL_ROOT'])
node = os.environ['DOC2VID_INSTALL_NODE']
home = str(Path.home())
names = ['com.albinilabs.doc2vid.plist', 'com.albinilabs.doc2vid-awake.plist']
# The tunnel only runs once its token has been placed (it is created in the Cloudflare account, not here).
if (Path.home() / '.config' / 'doc2vid' / 'tunnel-token').exists():
    names.append('com.albinilabs.doc2vid-tunnel.plist')
for name in names:
    source = (root / 'deploy' / name).read_text()
    for key, value in {'@NODE@': node, '@SERVER@': str(root / 'server'), '@HOME@': home}.items():
        source = source.replace(key, escape(value))
    (Path.home() / 'Library' / 'LaunchAgents' / name).write_text(source)
PY
DOMAIN="gui/$(id -u)"
labels='com.albinilabs.doc2vid com.albinilabs.doc2vid-awake'
if [ -f "$HOME/.config/doc2vid/tunnel-token" ]; then labels="$labels com.albinilabs.doc2vid-tunnel"; fi
for label in $labels; do
  plist="$HOME/Library/LaunchAgents/$label.plist"
  launchctl bootout "$DOMAIN/$label" >/dev/null 2>&1 || true
  # bootout returns before the job is fully removed; bootstrapping too early fails with "Input/output error".
  tries=0
  while launchctl print "$DOMAIN/$label" >/dev/null 2>&1 && [ "$tries" -lt 50 ]; do sleep 0.2; tries=$((tries + 1)); done
  launchctl bootstrap "$DOMAIN" "$plist"
  launchctl kickstart -k "$DOMAIN/$label"
done
printf 'doc2vid LaunchAgents installed. Logs: %s/Library/Logs/doc2vid/\n' "$HOME"
