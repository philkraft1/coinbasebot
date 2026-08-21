#!/usr/bin/env bash
# Run on a machine whose Origin login can write ivorycrowncollective/coinbasebot.
# This cloud agent's token is scoped read-only for that repo (HTTP 403).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v origin >/dev/null 2>&1; then
  echo "Install Origin CLI first, then: origin auth login" >&2
  echo "https://cursor.com/docs/origin/cli" >&2
  exit 1
fi

origin auth status
git remote set-url origin https://origin.cursor.com/ivorycrowncollective/coinbasebot.git
git push -u origin main
echo "Pushed main to ivorycrowncollective/coinbasebot"
