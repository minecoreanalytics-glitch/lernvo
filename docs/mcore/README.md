# Lernvo as a Morpheus tentacle (m-core)

Lernvo computes **knowledge-assurance signals per department** (30-day window) and, when connected
to the Morpheus head, sends them and receives ranked recommendations. Without the head, the same
doctrine is applied locally so the *Signaux* page is always useful.

| Signal | Meaning |
|---|---|
| `coverage_pct` | acknowledgments of current approved procedures / (approved docs × active employees) |
| `quiz_fail_rate` | failed / total quiz attempts |
| `overdue_ratio` | overdue / open assignments with a due date |
| `unanswered_questions` | assistant questions with zero KB match |
| `stale_docs` | approved documents older than 180 days |
| `pending_reviews` | items waiting for approval > 7 days |

## Enable for a tenant
1. Platform env (compose): `MORPHEUS_CORE_URL`, `MORPHEUS_API_KEY`.
2. Seed the framework on the head for the tenant: copy `lernvo-knowledge-assurance-v1.json`, set
   `tenant_id` (e.g. `lernvo-acme`), store it as `tenants/<tenant_id>.framework` (Firestore, project
   of the head) — same procedure as M-Shield.
3. `PATCH /api/tenants/:id/mcore { "mcoreTenant": "lernvo-acme" }` (SUPER_ADMIN).
4. Admin → *Signaux* → *Envoyer au Core* (or wait: signals are pushed on demand; add a cron if needed).

Endpoints: `GET /api/mcore/status`, `GET /api/mcore/insights[?refresh=1]`, `POST /api/mcore/push`.
Head calls: `POST /api/morpheus/recommend` (customer_id = `dept:<id>`, context = signals),
`GET/POST /subjects`, `POST /signals/batch`.

## Cross-tentacle loop (the point)
M360 sees an outage/billing spike → head → Lernvo pushes a micro-module + acknowledgment to the
affected department → coverage measured before agents take calls. Requires a head policy whose action
targets `lernvo` (`assign_module`, `notify_department`) — next step once both tentacles share a tenant id.
