#!/bin/sh
# Browser checks for the app at iPhone size: setup, logging, data, plans and charts.
#   npx expo export --platform web && sh e2e/run.sh
# Needs Playwright with Chromium (PLAYWRIGHT=path/to/playwright, CHROMIUM=path/to/chrome if not on the default path).
set -e
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
PORT=${PORT:-8793}
node e2e/make-backup.js > "$OUT/backup.json"
python3 scripts/serve-web.py dist "$PORT" & SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1
FAILED=0
for t in setup log data plan chart settings extras clock; do
  echo "== $t"
  PORT=$PORT node "e2e/$t.js" "$OUT" | tee "$OUT/$t.txt"
  grep -q '^FAIL\|CRASH' "$OUT/$t.txt" && FAILED=1
done
echo "Screenshots: $OUT"
exit $FAILED
