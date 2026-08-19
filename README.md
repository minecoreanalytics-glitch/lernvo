# Lernvo

Multi-tenant platform that makes sure employees actually **know** their company's procedures and
products: approved single source of truth (workflow **draft → review → approved vN**, immutable
versions, "read & understood" acknowledgment with coverage KPI), modules & quizzes, learning paths,
certificates, knowledge base, AI content generation & assistant, gamification, onboarding, reporting.
One deployment serves many companies; each company is an isolated **tenant** with its own
subdomain (`<slug>.lernvo.com`), branding, users and data.

**Production:** https://lernvo.com · Company spaces: `https://<slug>.lernvo.com`

## Stack

| Layer | Tech |
|---|---|
| Backend | Node 20 · Express · TypeScript · Prisma 5 · PostgreSQL 16 · Redis |
| Frontend | React 18 · Vite · TypeScript · Tailwind · TanStack Query · PWA |
| AI (optional) | Google Gemini (`GEMINI_API_KEY`) — module/quiz/KB generation, chatbot |
| Email (optional) | any SMTP (`SMTP_*`) |
| Tests | Vitest + Supertest (backend), `tsc` + build (frontend), tenant-neutrality gate |

## Multi-tenancy in one paragraph

Every business row carries a `tenantId`. A Prisma client extension (`backend/src/utils/prismaTenant.ts`)
injects the tenant from the request context (`AsyncLocalStorage`, filled from the JWT) into **every**
query — you never filter by tenant by hand, and a query outside a tenant context fails closed.
`SUPER_ADMIN` (platform staff) is the only role that can operate across tenants
(`tenantStore.run({ tenantId: null, superAdmin: true }, …)`). Tenant subdomains are resolved from the
`Host` header (`backend/src/utils/tenantHost.ts`); branding is served by `GET /api/branding`.

**Rule:** customer-specific data (org charts, price lists, procedures, brand names) lives in the
database of that tenant — never in the code. CI enforces it (`scripts/check-tenant-neutral.sh`).

## Local development (5 minutes)

Prereqs: Node 20+, Docker.

```bash
git clone https://github.com/minecoreanalytics-glitch/lernvo.git && cd lernvo
docker compose -f docker-compose.dev.yml up -d          # Postgres :5432 + Redis :6379
cp backend/.env.example backend/.env                     # dev defaults already match the compose file
npm run install:all
npm run db:push                                          # create the schema
npm run db:seed                                          # demo tenant + users (see below)
npm run dev                                              # backend :4000 + frontend :3000
```

Open http://localhost:3000 and log in with a demo account (password `LernvoDemo2026!`):

| Email | Role |
|---|---|
| `superadmin@lernvo.com` | SUPER_ADMIN (platform) |
| `platform_manager@acme.demo` | PLATFORM_MANAGER (tenant admin) |
| `hr@acme.demo` / `manager@acme.demo` / `supervisor@acme.demo` / `agent@acme.demo` | tenant roles |

Tests:

```bash
cd backend && npm test        # uses lernvo_test DB (backend/.env.test), created by docker/dev-init.sql
cd frontend && npx tsc --noEmit && npm run build
bash scripts/check-tenant-neutral.sh
```

Optional: set `GEMINI_API_KEY` in `backend/.env` to enable AI features and the chatbot; set `SMTP_*`
to enable emails. Both are silently disabled when empty.

## Repository layout

```
backend/            Express API — src/routes (one file per domain), src/services, src/utils/prismaTenant.ts
backend/prisma/     schema.prisma (single source of truth for the DB)
frontend/           React SPA — src/pages, src/components, src/hooks/useBranding.ts
docker/             production compose (docker-compose.lernvo.yml), nginx, dev-init.sql
docs/               NEW_TENANT.md (tenant onboarding runbook)
scripts/            check-tenant-neutral.sh (CI gate)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — fork → branch → PR. Every PR must keep the test suite,
the TypeScript build and the tenant-neutrality gate green.

## Public API (website)

See [docs/PUBLIC_API.md](docs/PUBLIC_API.md) — approved, publiable articles (products, prices, FAQ) served read-only per tenant.

## Operating a new tenant

See [docs/NEW_TENANT.md](docs/NEW_TENANT.md).

## License

**Business Source License 1.1** (see [LICENSE](LICENSE)). You may read, run, modify and contribute;
a single company may use it in production for its own employees. Offering Lernvo (or a derivative)
as a hosted/managed service or a competing product requires a commercial license from
Groupe Altis Holding Inc. Each version converts to Apache-2.0 four years after its release.
