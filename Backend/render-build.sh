#!/usr/bin/env bash
set -euo pipefail

# In das Verzeichnis wechseln, in dem dieses Skript liegt (Repo-Root)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "==> Installing Python dependencies"
pip install -r requirements.txt

echo "==> Building React frontend"
cd "$SCRIPT_DIR/frontend"   # Ordnername ist klein geschrieben!
npm ci
# CRA kann in CI bei Warnungen fehlschlagen – verhindern:
export CI=false
npm run build

echo "==> Build finished"