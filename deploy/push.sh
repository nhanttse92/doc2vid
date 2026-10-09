#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
HOST=${DOC2VID_HOST:-nhantrinh@nhans-mac-mini.tail199cfc.ts.net}
rsync -a --delete \
  --exclude='.git' --exclude='node_modules' --exclude='jobs' \
  --exclude='build' --exclude='out' --exclude='__pycache__' \
  --exclude='.env' --exclude='*.env' --exclude='server.env' \
  "$ROOT/" "$HOST:doc2vid/"
# A non-interactive ssh shell lacks Homebrew's PATH, so tools like node and python3 3.14 would not be found.
ssh "$HOST" "export PATH=/opt/homebrew/bin:\$HOME/.local/bin:\$PATH DOC2VID_RESTART_AGENT=${DOC2VID_RESTART_AGENT:-0}; cd ~/doc2vid && sh deploy/install.sh"
