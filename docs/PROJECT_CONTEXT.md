# Lernvo Project Context

Last updated: 2026-09-05

## Current objective

Ship the native iOS and Android Lernvo apps to TestFlight / Play internal testing, then to the
stores, while preserving the existing web administration and backend. The app is frontline-first
(closer to Axonify than a course catalog) and must look like the Lernvo web product (navy palette,
briefcase-and-check mark).

## Approved decisions

- React Native with Expo SDK 57 is the mobile platform; Capacitor and WebView shells are rejected
  (re-confirmed by the owner on 2026-09-01 after seeing both side by side).
- Navigation (owner decisions 2026-09-02): tab bar mirrors the web mobile nav plus the
  assistant, **Accueil · Formations · Données · Assistant · Top**; everything about the person
  (profile, career paths, certificates, department, settings, sign-out) is behind the avatar
  top-right, announcements behind the bell next to it. Pull-to-refresh on every list.
- Visual direction (owner references 2026-09-02: Apple design resources, "Modern Floating
  Navbar" kit, HyperMart and clinic-booking concepts): floating pill tab bar detached from the
  edge with the active destination raised in a navy orb (Liquid Glass surface on iOS 26 via
  expo-glass-effect, frosted white elsewhere), glass bell/avatar chips, layered Home (ask bar,
  priority card with depth and a floating icon chip, colour quick-access tiles), 24-28 pt radii
  and soft elevation on cards. No flat 2010-style bars.
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
- Latest mobile feature work: `feat/account-topright-nav` (`a0933ab`, PR #4), ahead of `main`
  (`660ee46`). The historical `.worktrees/mobile-foundation` path now holds this feature branch.
- Launch hardening takeover: `codex/lernvo-launch-hardening`, based on the full PR #4 branch.
  Preserve the original worktree; see `docs/mobile/LAUNCH_STATUS_2026-09-05.md`.
- GitHub repository: `https://github.com/minecoreanalytics-glitch/lernvo`
- EAS project: `@tbijou/lernvo` (id `90319661-35ba-47b7-b461-3e7bcee601a5`)

## Verified takeover (2026-09-05)

- Inspected canonical checkout, feature worktree, GitHub PRs/CI, and EAS build history.
- The last feature commit passed Mobile CI but failed backend CI because leaderboard caching
  waited on unavailable Redis and rejected outside Express error handling.
- Corrected optional leaderboard caching, async mobile route failures, complete/unique quiz-answer
  validation, server-side required-section and attempt-limit enforcement, and module completion
  after published exams pass. Added 8 backend integration regression cases.
- Mobile refresh now retains secure credentials after network/503 failures and clears them only
  after explicit auth rejection. Module/inbox mutation errors are visible; unfinished sections
  are no longer labelled done; media tokens are limited to Lernvo uploads.
- Verified locally: 89 backend tests against a disposable PostgreSQL database with Redis absent;
  54 mobile tests; TypeScript builds; iOS and Android JavaScript bundles. No production DB used.
- Expo compatibility check required three SDK 57 patch updates (expo/router/sharing).
- Public health endpoint reports PostgreSQL and Redis healthy. `/privacy` redirects to `/login`
  in a fresh browser, so the privacy policy is NOT publicly available.
- Existing Android internal APK is a successful older build at `801b799`, not the latest feature
  revision. No iOS build was returned in the project build history inspected.
- Offline outbox infrastructure exists but learner mutations are not connected to it and screen
  queries have no durable content cache. Full offline learning remains unimplemented.
- No assertion of store readiness: signing/submission, real-device journeys, public privacy,
  push/deep links, reinforcement and coaching still require work. See the launch-status report.

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
- Mobile app (`mobile/`): secure auth (SecureStore, tenant slug at sign-in), floating glass tab bar
  (Accueil · Formations · Données · Assistant · Top), account behind the top-right avatar, bell →
  Notifications | Annonces. **Web parity screens (2026-09-02 evening)**: Devoirs (assignments),
  Parcours carrière detail, Départements (org tree + members), Données = Documents | Tarifs + search,
  Mon compte (rank, badges, shareable certificates, change password), module viewer with inline
  video/audio/PDF (expo-video, expo-audio, WebView) authorised by `GET /api/mobile/v1/media-token`
  (deployed). These screens call the web API (`/api/*`) with the same JWT through `src/api/web.ts`,
  so they stay in lockstep with the web without new backend work. Offline outbox + sync
  coordinator, FR/EN catalogue with parity test, brand icon/adaptive icon/splash, store-oriented
  `app.json` and `eas.json`. 49 unit tests, `tsc` clean, `expo-doctor` 21/21.
- Runs in **Expo Go** on the owner's iPhone through an Expo tunnel (all native modules are Expo SDK
  packages); dev clients need a rebuild after each new native module (`expo prebuild` + `pod install`).
- Local iOS development build (with expo-localization + splash) runs on the iPhone 17 simulator,
  pointed at lernvo.com; sign-in renders in French with the brand mark, icon and FR/EN
  localizations verified in the built bundle. Building from an iCloud-synced checkout needs the
  `xattr -cr` workaround documented in `mobile/README.md`.
- PR #2 merged into `main` (squash `7c31f4e`) with CI green (backend, frontend, tenant-neutral,
  mobile, mobile-api-contract). This is a historical deployment record, not proof that current
  main or the latest feature branch matches production.

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
