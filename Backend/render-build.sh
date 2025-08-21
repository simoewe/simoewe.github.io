#!/usr/bin/env bash
set -euo pipefail

echo "==> Detecting paths"

# Ordner, in dem dieses Skript liegt
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Repo-Root ermitteln (entweder dieses Verzeichnis, dessen Parent, oder Parent vom Parent)
if [ -d "$SCRIPT_DIR/frontend" ]; then
  REPO_ROOT="$SCRIPT_DIR"
elif [ -d "$SCRIPT_DIR/../frontend" ]; then
  REPO_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
elif [ -d "$SCRIPT_DIR/../../frontend" ]; then
  REPO_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
else
  echo "ERROR: Konnte 'frontend/' relativ zu $SCRIPT_DIR nicht finden."
  echo "Erwartete Struktur: <repo-root>/frontend und <repo-root>/Backend"
  exit 1
fi

echo "SCRIPT_DIR = $SCRIPT_DIR"
echo "REPO_ROOT  = $REPO_ROOT"

# requirements.txt finden (entweder im Repo-Root oder in Backend/)
if [ -f "$REPO_ROOT/requirements.txt" ]; then
  REQ_FILE="$REPO_ROOT/requirements.txt"
elif [ -f "$REPO_ROOT/Backend/requirements.txt" ]; then
  REQ_FILE="$REPO_ROOT/Backend/requirements.txt"
else
  echo "ERROR: requirements.txt nicht gefunden (weder im Repo-Root noch in Backend/)."
  exit 1
fi
echo "REQ_FILE   = $REQ_FILE"

# 1) Python-Dependencies
echo "==> Installing Python dependencies"
pip install -r "$REQ_FILE"

# 2) Frontend bauen
FRONTEND_DIR="$REPO_ROOT/frontend"   # bei dir klein geschrieben
echo "==> Building React frontend in: $FRONTEND_DIR"
cd "$FRONTEND_DIR"
npm ci
export CI=false
npm run build

echo "==> Build finished successfully"
