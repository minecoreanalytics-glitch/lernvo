# NEW_TENANT — Onboarding a company on Lernvo

Runbook for platform staff (SUPER_ADMIN). Total: ~10 minutes. No server change is needed for a
new tenant: DNS is a wildcard, TLS is issued on demand, isolation is row-level.

## 1. Create the tenant (2 ways)

**A. Self-service** — the customer signs up at `https://lernvo.com/signup` (company name → slug,
first admin email/password). The tenant is created **PENDING**, the admin inactive.

**B. Staff-created** — as SUPER_ADMIN, POST the same signup payload, or insert directly.

Slug rules: lowercase, `a-z0-9-`, becomes the subdomain (`<slug>.lernvo.com`). Reserved:
`www`, `api`, `app`, `admin`, `mail`, `static`.

## 2. Approve

Log in as SUPER_ADMIN → **/admin/tenants** → *Approuver*. This sets `ACTIVE`, activates the tenant's
`PLATFORM_MANAGER` users and — because `GET /api/branding/tls-check` now answers 200 for the
subdomain — enables `https://<slug>.lernvo.com` (first request triggers the certificate, ~5 s).

## 3. Branding (by the tenant admin, in the app)

`Mon profil` → *Mon organisation*: display name, logo URL, support email.
Served on the tenant subdomain (login page, top bar, sidebar) via `GET /api/branding`.
On the apex `lernvo.com` the platform branding is shown and any tenant can log in; on
`<slug>.lernvo.com` **only that tenant's users** can log in (host lock).

## 4. Data import (optional, one-shot)

If the customer brings existing data (users, departments, modules, quizzes, KB), import it **once**
into the tenant with SQL/`INSERT … SELECT` setting `tenantId`, then never again — from that point the
Lernvo DB is the single source of truth. Passwords: import bcrypt hashes as-is if the source uses
bcrypt; otherwise send reset links. Uploads go to the `lernvo_uploads` volume.

## 5. Hand-off checklist

- [ ] Tenant ACTIVE, subdomain answers 200 over HTTPS
- [ ] Admin logged in, branding set
- [ ] Departments / categories created (or imported)
- [ ] First module published, one test employee enrolled
- [ ] `GEMINI_API_KEY` / `SMTP_*` set on the platform if the customer expects AI / emails
- [ ] Customer told: same login on `<slug>.lernvo.com`, support email

## Infrastructure notes (platform staff)

- DNS: `A *.lernvo.com → VPS` (wildcard) + apex.
- Reverse proxy: Caddy `*.lernvo.com` block with `tls { on_demand }` and global
  `on_demand_tls { ask http://127.0.0.1:8095/api/branding/tls-check }` — certificates are only issued
  for the apex and ACTIVE tenant slugs (prevents abuse / ACME rate limits).
- App: single Docker stack (`docker/docker-compose.lernvo.yml`, project `lernvo`), one Postgres,
  row-level isolation. Uploads persisted in the `lernvo_uploads` volume.
- Schema changes: `docker compose -p lernvo -f docker-compose.lernvo.yml run --rm --no-deps backend npx prisma db push`
  (additive only), then `up -d backend frontend`.
