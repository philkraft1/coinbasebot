#!/usr/bin/env bash
# Create github.com/<owner>/coinbasebot from this checkout and push main.
# Requires GitHub CLI auth: gh auth login
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI first: https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not signed in to GitHub. Run: gh auth login" >&2
  exit 1
fi

REPO="${1:-coinbasebot}"
VISIBILITY="${2:-private}"

if [[ "$VISIBILITY" != "private" && "$VISIBILITY" != "public" ]]; then
  echo "Visibility must be private or public" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

if git remote get-url github >/dev/null 2>&1; then
  echo "Remote 'github' already exists: $(git remote get-url github)"
  git push -u github main
  exit 0
fi

gh repo create "$REPO" \
  --"$VISIBILITY" \
  --source=. \
  --remote=github \
  --description "Cursor-ready Coinbase Payments MCP — agentic wallet, onramp, and x402 payments" \
  --push

echo
echo "GitHub remote:"
git remote get-url github
gh repo view "$REPO" --web
