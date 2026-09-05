# Lernvo launch takeover — 2026-09-05

## Actual source state

Repository: https://github.com/minecoreanalytics-glitch/lernvo

- Canonical checkout: `~/Documents/Minecore-Group/Projects/Active/lernvo`, main `660ee46`.
- Most recent existing development: `.worktrees/mobile-foundation`, branch
  `feat/account-topright-nav`, commit `a0933ab`, PR #4.
- Takeover branch: `codex/lernvo-launch-hardening`, preserving all feature commits.
- Earlier native foundation (PR #2) and five-tab navigation (PR #3) were merged.
- Later feature work includes floating navigation, account/notifications, documents/pricing,
  assignments, career paths, departments, badges, media readers and slide decks.

## Corrections in this takeover

1. Leaderboard falls back to PostgreSQL when Redis is disconnected, rejects or contains invalid JSON.
   Cache keys also include result limit. Existing feature CI had timed out on this path.
2. Mobile async route failures return a recoverable JSON 500 instead of an unhandled rejection.
3. Quiz submissions require every question exactly once and valid option IDs; complete required
   sections and the attempt limit are enforced by the server. Scores use the complete quiz.
4. Module completion waits for its published final exams. Already-completed enrollments are
   preserved; no historical production learning record was altered.
5. Transient refresh failure no longer deletes secure credentials. Explicit 401/403 still signs out.
6. Module and inbox writes show errors. Unfinished sections are not labelled completed.
7. Media tokens are appended only to uploads at the configured Lernvo API origin.
8. Expo SDK 57 patch dependencies aligned with the current compatibility check.

## Verification

- Backend: 89 tests passed, including 8 new release regression cases and cross-tenant tests.
- Mobile: 54 tests passed (2 new transient-refresh cases), TypeScript clean.
- Backend TypeScript build passed; runtime dependency audit: 0 high/critical, 4 moderate advisories.
- Expo doctor: 21/21 checks after SDK 57 patch updates.
- iOS and Android JavaScript exports passed. These do not prove signed native installation.
- Production read-only check: `/api/health` returned PostgreSQL/Redis `ok`.
- Browser check: `https://lernvo.com/privacy` redirected to `/login`.
- Original failed CI: https://github.com/minecoreanalytics-glitch/lernvo/actions/runs/33758324941

## Current build and access status (verified 2026-09-05)

- Takeover PR: https://github.com/minecoreanalytics-glitch/lernvo/pull/5 (draft).
- All seven observed GitHub checks passed for code revision `361b229` (backend, frontend,
  tenant-neutral, mobile and mobile-api-contract including push/PR runs).
- New Android preview build **FINISHED** at 2026-09-05 22:26:42 UTC, code revision `361b229`.
  Build: https://expo.dev/accounts/tbijou/projects/lernvo/builds/80f763c8-9c4d-4b84-8657-5bd93fd588ce
  APK: https://expo.dev/artifacts/eas/w40d0YiExp-wQhL67gZE2SXjCSowRVeVr1Pyee5x3XA.apk
  Native build completion is verified; installation and learner journeys on an Android phone
  are not yet verified. The APK points to the existing production API, which has not received
  the backend fixes in this branch.
- iOS production build stopped before compilation: EAS reports distribution credentials are
  not configured and requires interactive Apple authentication. Remote build number initialized
  to 1; no iOS artifact or TestFlight submission was created.
- Production DNS resolves to `187.77.215.98`. Read-only SSH through `accesshaiti-vps` failed with
  `Permission denied (publickey,password)`. No production changes were attempted.
- Durable worktree is `.worktrees/launch-hardening`; its mobile npm dependencies are installed.

### Next owner action for Apple signing

Run in your terminal, then complete the Apple authentication prompts yourself:

```sh
cd ~/Documents/Minecore-Group/Projects/Active/lernvo/.worktrees/launch-hardening/mobile
COREPACK_ENABLE_AUTO_PIN=0 eas build --platform ios --profile production
```

For backend deployment, restore valid SSH authentication for the existing Lernvo host. Do not
paste private keys, Apple passwords or verification codes into project files or chat.

## Existing Android artifact

Successful internal build `36d3519b-e8e9-479b-a8e7-3068d4e8e78e`, commit `801b799`,
completed 2026-09-03. This predates the latest account/media/slide work.

Build page: https://expo.dev/accounts/tbijou/projects/lernvo/builds/36d3519b-e8e9-479b-a8e7-3068d4e8e78e

## Ordered launch work

1. Verify CI for the takeover branch; merge the intended release through review.
2. Deploy the reviewed backend with the existing backup/rollback process and `-p lernvo`.
   No deployment was performed during the initial hardening checks.
3. Android preview APK is built; complete iOS signing and build the iOS store candidate. EAS project remains
   `@tbijou/lernvo`, ID `90319661-35ba-47b7-b461-3e7bcee601a5`.
4. Verify actual device journeys: company sign-in, content/media, final quiz, announcements,
   expiry/refresh, logout/relaunch, FR/EN, and interrupted network writes.
5. Complete App Store Connect app identity/signing and replace placeholder `ascAppId`;
   complete Google Play app/service-account setup as required by the chosen track.
6. Publish a verified public privacy policy and link it from the native account screen.
   Confirm the actual operator/contact, processors (including AI), retention and deletion flow
   before publishing statements. The existing store copy must be checked against current code.
7. Provide store screenshots, reviewer access to a dedicated non-customer tenant, and submit.

## Open product gaps and limits

- Full offline learning is NOT delivered: outbox infrastructure has no learner mutation callers;
  screen loaders use component state and do not restore cached content after process termination.
- Push notifications, universal/app links, reinforcement engine and manager coaching are roadmap work.
- Do not advertise the entire approved program as finished based on an internal build.
- The web section-quiz flow is separate from mobile final-exam grading; its subset scoring and
  concurrency/idempotency need a dedicated assessment before broad compliance claims.
- Native mutations have visible failure feedback but still need durable offline replay and
  duplicate-submission/device-level acceptance tests before general release.
- No public store submission, reviewer invitations, production schema changes, or customer messages
  were performed by this takeover.

## Official release references

- https://docs.expo.dev/submit/testflight/
- https://docs.expo.dev/build/internal-distribution/
- https://developer.apple.com/app-store/review/guidelines/
