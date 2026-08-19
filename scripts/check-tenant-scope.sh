#!/bin/bash
# Tenant-scope gate: every Prisma model must either carry `tenantId` AND be listed in the SCOPED set
# of backend/src/utils/prismaTenant.ts, or be explicitly allow-listed here as platform-global.
set -euo pipefail
SCHEMA=backend/prisma/schema.prisma
EXT=backend/src/utils/prismaTenant.ts
GLOBAL_ALLOWLIST="Tenant Badge RefreshToken Lead"   # Lead = marketing form submissions, pre-tenant   # the only models that may live without tenantId

models=$(grep -E '^model ' "$SCHEMA" | awk '{print $2}')
scoped=$(sed -n '/const SCOPED = new Set(\[/,/\])/p' "$EXT" | grep -oE "'[A-Za-z]+'" | tr -d "'")
fail=0
for m in $models; do
  has_tenant=$(awk "/^model $m \\{/,/^\\}/" "$SCHEMA" | grep -cE '^\s*tenantId\s+String' || true)
  if echo " $GLOBAL_ALLOWLIST " | grep -q " $m "; then
    if [ "$has_tenant" != "0" ]; then echo "FAIL: $m is allow-listed as global but has tenantId"; fail=1; fi
    continue
  fi
  if [ "$has_tenant" = "0" ]; then echo "FAIL: model $m has no tenantId column (add it, or allow-list it as platform-global with a justification)"; fail=1; fi
  if ! echo "$scoped" | grep -qx "$m"; then echo "FAIL: model $m carries tenantId but is missing from SCOPED in prismaTenant.ts"; fail=1; fi
done
[ $fail -eq 0 ] && echo "OK: $(echo "$models" | wc -l | tr -d ' ') models — all tenant-scoped or explicitly global ($GLOBAL_ALLOWLIST)"
exit $fail
