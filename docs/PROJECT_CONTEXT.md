# Lernvo Project Context

Last updated: 2026-09-02

## Current objective

Ship the native iOS and Android Lernvo apps to TestFlight / Play internal testing, then to the
stores, while preserving the existing web administration and backend. The app is frontline-first
(closer to Axonify than a course catalog) and must look like the Lernvo web product (navy palette,
briefcase-and-check mark).

## Approved decisions

- React Native with Expo SDK 57 is the mobile platform; Capacitor and WebView shells are rejected
  (re-confirmed by the owner on 2026-09-01 after seeing both side by side).
- Learner navigation: Today, Learn, Docs, Ask, Inbox, Me. Docs was added on 2026-09-01 because
  employees must be able to read approved procedures (knowledge base) on mobile.
- Managers get a role-gated Team screen without turning the learner experience into a dashboard.
- French and English from the first pilot, resolved from the device language.
- AI can draft, summarize, translate, and explain. Deterministic services own scoring, compliance,
  mastery, and certification.
- Offline support: SQLite outbox with idempotency keys, append-only learning events, server conflict
  resolution. The backend remains authoritative for compliance and certificate state.
- Delivery is organized into five workstreams: foundation/sync, reinforcement/admin, frontline
  experience, manager experience, production/store hardening.

## Source of truth

- Product and architecture spec: `docs/superpowers/specs/2026-08-28-lernvo-native-mobile-design.md`
- Store release runbook: `docs/mobile/STORE_RELEASE.md`
- Code: `main` (the `codex/lernvo-mobile-foundation` branch and its worktree
  `.worktrees/mobile-foundation` are merged; start new work from `main`)
- GitHub repository: `https://github.com/minecoreanalytics-glitch/lernvo`
- EAS project: `@tbijou/lernvo` (id `90319661-35ba-47b7-b461-3e7bcee601a5`)

## Current implementation state (2026-09-02)

Done and verified:

- Backend `/api/mobile/v1`: bootstrap, today, learn, modules/:id (+start), contents/:id/progress,
  quizzes/:id (+submit, server-graded), inbox (+read), me, team, kb, kb/:id, ask, sync/events.
  Tenant-scoped Prisma client throughout. Tests: mobileContract, mobileRefresh,
  mobileEventIngestion, mobileLearner (79 backend tests; the only local failure is
  `crossTenant` when the gitignored `backend/.env` sets `DOMAIN=localhost`, green with
  `DOMAIN` unset as in CI).
- **Deployed to production on 2026-09-02 ~18:30 UTC**: rsync to `/opt/lernvo/backend`, image
  rebuilt, `prisma db push` added `MobileLearningEvent` + `MobileSyncCursor` (additive), backend
  restarted healthy. Backup `/opt/lernvo-backups/daily/lernvo_20260902_182816.dump`, rollback
  image `lernvo-backend:rollback-20260902`. Verified live: htvuniversity.com, htv.lernvo.com and
  lernvo.com 200; demo tenant login + bootstrap/today/learn/kb/inbox/me all 200 through
  `https://lernvo.com/api/mobile/v1`.
- Mobile app (`mobile/`): secure auth (SecureStore, tenant slug at sign-in), six learner tabs,
  Team, module detail, quiz, document reader, offline outbox + sync coordinator, FR/EN catalogue
  with parity test, brand icon/adaptive icon/splash, store-oriented `app.json` and `eas.json`.
  49 unit tests, `tsc` clean, `expo-doctor` 21/21, iOS and Android JS bundles export.
- Local iOS development build (with expo-localization + splash) runs on the iPhone 17 simulator,
  pointed at lernvo.com; sign-in renders in French with the brand mark, icon and FR/EN
  localizations verified in the built bundle. Building from an iCloud-synced checkout needs the
  `xattr -cr` workaround documented in `mobile/README.md`.
- PR #2 merged into `main` (squash `7c31f4e`) with CI green (backend, frontend, tenant-neutral,
  mobile, mobile-api-contract). `main` now matches production.

In progress / next:

1. Android internal APK via `eas build --platform android --profile preview` (queued from this
   machine; no local Android SDK is installed, so Android verification goes through EAS).
2. Owner-only store steps (Apple ID / Play Console) listed in `docs/mobile/STORE_RELEASE.md`.
3. Push notifications (expo-notifications + APNs/FCM through EAS) and deep links: not started.
4. Reinforcement engine (workstream 2) and manager coaching (workstream 4): not started.
5. `expo-system-ui` if we want `userInterfaceStyle`/`backgroundColor` enforced natively.
6. Delete the stray EAS project `@tbijou/lernvo-backend` on expo.dev (created by mistake; the real
   one is `@tbijou/lernvo`).

## Non-negotiable invariants

- No secrets or tokens in logs, source control, AsyncStorage, or analytics.
- No client-only grant of compliance, certificate, or final score.
- Offline event replay must be safe under retries and duplicate delivery.
- Every learning event records source/content version so audits remain reproducible.
- Accessibility, reduced motion, localization, and dynamic type are release requirements.
- Never run `docker compose` in `/opt/lernvo/docker` without `-p lernvo`; check htvuniversity.com
  before and after any production change.

## Handoff protocol

At the end of a meaningful work unit, update this file with the completed milestone, branch/commit,
verification evidence, and next executable task. Keep details in implementation plans and link
them rather than duplicating them here.
