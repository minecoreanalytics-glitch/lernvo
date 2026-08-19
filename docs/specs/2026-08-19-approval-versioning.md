# Spec — Approval workflow, versioning & acknowledgment ("source de vérité")

**Date:** 2026-08-19 · **Status:** implemented v1

## Problem

Procedures, product sheets and price lists are useless if employees do not know them, and
dangerous if several versions circulate. Lernvo must be the single, approved source of truth and
must *prove* who has read the current version.

## Principle (tenant-agnostic)

Any knowledge item goes through the same lifecycle, whatever its type:

```
DRAFT ──submit──▶ IN_REVIEW ──approve──▶ APPROVED (vN)
   ▲                  │ reject                │ edit
   └──────────────────┴───────────────────────┘  (back to DRAFT; employees keep seeing vN)
```

- **Approve** = freeze an immutable **version snapshot** (vN), publish, notify:
  - every active employee of the tenant → *"Nouvelle version à lire et valider"* (in-app + email if SMTP);
  - managers (PLATFORM_MANAGER, HR) → *"X approuvé (vN) par Y"* — the only "alert" for offers/specials.
- **Acknowledge** = an employee confirms *"J'ai lu et compris"* on the current version. Coverage
  (`acked / active users`) is the KPI. Re-approval resets coverage (new version).
- While a newer draft is being edited, employees see the **last approved snapshot** — never a
  half-written procedure.
- No self-approval: the approver must differ from the submitter (PLATFORM_MANAGER may override).

## Data model (all tenant-scoped through the Prisma extension)

| Model | Purpose |
|---|---|
| `ApprovalItem(entityType, entityId, status, currentVersion, submittedBy/At, approvedBy/At, rejectedReason)` | one row per governed entity |
| `ContentVersion(entityType, entityId, version, snapshot Json, changeNote, createdById)` | immutable snapshots |
| `Acknowledgment(userId, entityType, entityId, version)` | proof of reading per version |

`entityType ∈ { KB_ARTICLE, MODULE }`. Modules use approve → publish; acknowledgment applies to KB
articles (modules already have enrollment/quiz as proof).

## API

| Route | Role | Effect |
|---|---|---|
| `GET /api/approvals/:type/:id` | any | status, current version, my ack, coverage (admins) |
| `POST /api/approvals/:type/:id/submit` | PLATFORM_MANAGER, HR, MANAGER, SUPERVISOR | DRAFT/REJECTED → IN_REVIEW |
| `POST /api/approvals/:type/:id/approve` `{note?}` | PLATFORM_MANAGER, HR (≠ submitter) | snapshot vN+1, publish, notify all + managers |
| `POST /api/approvals/:type/:id/reject` `{reason}` | PLATFORM_MANAGER, HR | → REJECTED, notify submitter |
| `POST /api/approvals/:type/:id/ack` | any | acknowledge current version |
| `GET /api/approvals/:type/:id/history` | any | versions (admins see snapshots) |
| `GET /api/approvals/pending` | PLATFORM_MANAGER, HR | items IN_REVIEW + coverage of approved items |
| `GET /api/approvals/my-pending` | any | approved items I have not acknowledged yet |

Editing an APPROVED KB article (`PUT /api/kb/:slug`) moves it back to DRAFT automatically.
`GET /api/kb/:slug` serves the approved snapshot to non-admins while a draft is pending.

## UI

- KB article: status chip, Submit / Approve / Reject buttons by role, "J'ai lu et compris" banner
  for employees, version history + coverage bar for admins.
- Dashboard: "À valider" list (my pending acknowledgments).
- Admin: **Approbations** page (queue + coverage).
- Module detail: status chip + Submit / Approve / Reject (admins).

## Out of scope (next)

Quiz-gated acknowledgment (validate by passing a quiz), department-scoped audiences,
public read API of approved items (`/api/public/*`), price-grid entity type.
