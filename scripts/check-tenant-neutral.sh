#!/bin/bash
set -euo pipefail
# Tenant-neutrality gate: the codebase must never reference a specific customer
# (names, brands, domains). Customer data lives in the database (tenant), never in code.
# Scans source AND shell/build/static assets that ship to users. dist/ and node_modules excluded.
PATTERN='htv|hainet|access[ _-]?haiti|tele[ _-]?haiti'
hits=$(grep -rniE "$PATTERN" \
  backend/src backend/prisma \
  frontend/src frontend/index.html frontend/public frontend/vite.config.ts \
  --exclude-dir=node_modules --exclude-dir=dist --exclude='*.test.ts' || true)
if [ -n "$hits" ]; then
  echo "FAIL: customer-specific references found in code:"
  echo "$hits"
  exit 1
fi
echo "OK: codebase is tenant-neutral"
