#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
HOST=${DOC2VID_HOST:-nhantrinh@nhans-mac-mini.tail199cfc.ts.net}
rsync -a --delete \
  --exclude='.git' --exclude='node_modules' --exclude='jobs' \
  --exclude='build' --exclude='out' --exclude='__pycache__' \
  --exclude='.env' --exclude='*.env' --exclude='server.env' \
  "$ROOT/" "$HOST:doc2vid/"
ssh "$HOST" 'cd ~/doc2vid && sh deploy/install.sh'
