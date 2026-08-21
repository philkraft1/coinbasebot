#!/usr/bin/env bash
# Recreate this repo from coinbasebot.bundle (download from the agent artifacts).
set -euo pipefail
BUNDLE="${1:-coinbasebot.bundle}"
DEST="${2:-coinbasebot}"

if [[ ! -f "$BUNDLE" ]]; then
  echo "Usage: $0 <coinbasebot.bundle> [dest-dir]" >&2
  exit 1
fi

git clone "$BUNDLE" "$DEST"
cd "$DEST"
git remote remove origin 2>/dev/null || true
git remote add origin https://origin.cursor.com/ivorycrowncollective/coinbasebot.git
echo "Imported $BUNDLE into $DEST"
echo "Next: cd $DEST && bash scripts/push-from-your-pc.sh"
