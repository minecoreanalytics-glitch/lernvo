# Contributing to Lernvo

Lernvo is a **multi-tenant product**. Every contribution must work for *any* company using the
platform, not for one customer. That is the single most important rule of this repo.

## Workflow

1. **Fork** the repository and create a branch: `feat/<short-name>` or `fix/<short-name>`.
2. Run the stack locally (see README) and develop against the **demo tenant** (`acme-demo`) — never
   against production data.
3. Before opening a PR, run locally:
   ```bash
   cd backend && npx tsc --noEmit -p . && npm test
   cd ../frontend && npx tsc --noEmit -p . && npm run build
   bash scripts/check-tenant-neutral.sh
   ```
4. Open a **pull request** to `main`. Describe the business need generically ("a company needs to…"),
   what changed, and how you tested. Screenshots for UI changes.
5. A maintainer reviews, merges and deploys. Contributors never deploy and never touch production
   servers, databases or secrets.

## The rules (a PR is rejected if it breaks one)

| Rule | Why |
|---|---|
| **No customer names, brands, domains, org charts, price lists or emails in code.** They belong in the tenant's data (DB), or in tenant branding (`Tenant.name/logoUrl/…`). | One codebase, many customers. The CI gate `check-tenant-neutral.sh` fails otherwise. |
| **Never filter by `tenantId` by hand and never bypass the tenant extension** (`prisma` from `utils/prisma.ts` is already scoped). If you *must* cross tenants, use `tenantStore.run({ tenantId: null, superAdmin: true }, …)` and justify it in the PR. | Isolation is fail-closed by design; a manual bypass is a data leak. |
| **New tables that hold business data get a `tenantId` + relation to `Tenant`** (see `Department`, `Module`, `KbArticle`). Add the model name to the scoped list in `prismaTenant.ts` if applicable. | Otherwise rows are visible to every tenant. |
| **New settings are per-tenant or env-driven** — never hard-coded (`PLATFORM_NAME`, `DOMAIN`, `GEMINI_API_KEY`, `SMTP_*`). | Config, not code. |
| **Enums for company-specific concepts are forbidden** (e.g. an enum of subsidiaries). Use free-text fields or tenant-managed reference data (categories, departments). | Enums freeze one customer's structure into the product. |
| **Prompts, emails and UI strings use `PLATFORM_NAME` and the tenant name**, never a hard-coded product/company name. | Branding is per tenant. |
| **Schema changes are additive** (`prisma db push` in prod is applied by maintainers). Destructive changes need a migration plan in the PR. | Zero-downtime deploys, no data loss. |
| **Match existing style**; keep changes surgical; add/adjust tests when touching backend routes (see `backend/src/test`). | Reviewability. |

## Prototypes from a single customer

If a feature was first built for one company (in a fork or another repo), it is **ported, not merged**:
strip customer specifics, generalize the concept ("brands" → "categories", "3 hard-coded grids" →
"tenant-managed grids"), then open the PR here. The maintainers can help scope the generic version —
open an issue first with the business need.

## Reporting bugs

Open an issue with: what you did, what you expected, what happened, tenant/role used, screenshots,
and the request that failed (path + status) if any. Do **not** paste tokens, passwords or personal
data.
