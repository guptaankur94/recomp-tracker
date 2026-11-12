#!/bin/sh
# Runs every web app browser check (tests/web/*.test.js). Needs Python 3 and Playwright with Chromium;
# set PLAYWRIGHT (its folder) or CHROMIUM (a browser binary) if they aren't found on their own.
cd "$(dirname "$0")/../.." || exit 1
failed=0
for t in tests/web/*.test.js; do
  if ! node "$t" > /tmp/recomp-web-test.log 2>&1; then failed=1; fi
  grep -E '^(FAIL|[a-z0-9-]+: [0-9]+ passed)' /tmp/recomp-web-test.log
  grep -E 'Error' /tmp/recomp-web-test.log | head -3
done
[ "$failed" = 0 ] && echo "All web checks passed" || echo "Some web checks FAILED"
exit $failed
