#!/bin/bash
# usage: scripts/deploy.sh "commit message"   (builds, pushes master, publishes dist to gh-pages, waits for live bundle)
set -e
cd "$(dirname "$0")/.."
git add -A 2>/dev/null; git -c user.name="RezonX Elites" -c user.email="noreply@example.com" commit -q -m "$1" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" 2>&1 | grep -v warning || true
git push -q origin master 2>&1 | tail -1 || true
npx vite build 2>&1 | grep -E "rror|built"
(cd dist && rm -rf .git && touch .nojekyll && git init -q -b gh-pages && git add -A 2>/dev/null && git -c user.name="RezonX Elites" -c user.email="noreply@example.com" commit -q -m "Deploy RED SOL" && git remote add origin https://github.com/khancreative707-cmd/red-sol.git && git push -q -f origin gh-pages 2>&1 | tail -1)
B=$(ls dist/assets | grep '\.js$')
for i in 1 2 3 4 5 6 7 8; do sleep 15; L=$(curl -s https://khancreative707-cmd.github.io/red-sol/ | grep -o 'index-[A-Za-z0-9_-]*\.js'); [ "$L" = "$B" ] && echo "LIVE OK: $L" && exit 0; done
echo "live bundle not updated yet (local $B, live $L)"
