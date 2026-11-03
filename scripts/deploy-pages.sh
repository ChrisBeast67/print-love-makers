#!/usr/bin/env bash
# Deploy print-love-makers to the GitHub Pages project site:
#   https://chrisbeast67.github.io/print-love-makers/
#
# Usage: scripts/deploy-pages.sh
#
# The app source has NO hard-coded base path. The sub-path is injected only at
# build time via BASE_PATH, so the same code also builds for root hosting
# (Lovable / custom domain) with: npm run build
set -euo pipefail

cd "$(dirname "$0")/.."

REPO_URL="https://github.com/ChrisBeast67/print-love-makers.git"
if [ -f "$HOME/.credentials/github" ]; then
  TOKEN="$(sed -n 's/.*github_token=//p' "$HOME/.credentials/github" | tr -d '\n\r ')"
  REPO_URL="https://ChrisBeast67:${TOKEN}@github.com/ChrisBeast67/print-love-makers.git"
fi
BASE_PATH="${BASE_PATH:-/print-love-makers/}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> Building with BASE_PATH=$BASE_PATH"
BASE_PATH="$BASE_PATH" npm run build

echo "==> Preparing gh-pages content"
cp -r dist/. "$TMP/"
# SPA fallback: GitHub Pages serves this for unknown paths (deep links).
cp "$TMP/index.html" "$TMP/404.html"
# Never let Jekyll eat files starting with _ or excluding assets.
touch "$TMP/.nojekyll"

echo "==> Publishing to gh-pages branch"
cd "$TMP"
git init -q .
git checkout -q -b gh-pages
git add -A
git -c user.name="Percy Bot" -c user.email="percy@printlove.dev" \
  commit -q -m "Deploy print-love-makers"

git push -q --force "$REPO_URL" gh-pages:gh-pages
echo "==> Done: https://chrisbeast67.github.io/print-love-makers/"
