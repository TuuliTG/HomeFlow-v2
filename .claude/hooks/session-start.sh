#!/usr/bin/env bash
# Prepares cloud (Claude Code on the web) sessions so tests and lint work immediately.
# Local sessions are left alone: you manage node_modules yourself there.
set -euo pipefail

if [[ "${CLAUDE_CODE_REMOTE:-}" != "true" ]]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm ci --no-audit --no-fund >/dev/null
# Browsers for e2e are best effort: the cloud network policy may block the download.
npx playwright install chromium >/dev/null 2>&1 || echo "Playwright browsers unavailable; rely on CI for e2e." >&2
echo "Dependencies installed. Run 'npm run verify' before opening a PR."
