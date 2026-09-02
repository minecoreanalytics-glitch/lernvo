# Lernvo Mobile Foundation and Secure Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan. Use superpowers:test-driven-development for each task and superpowers:verification-before-completion before claiming the workstream complete.

**Goal:** Establish a production-shaped Expo client that can authenticate safely, render native role-aware navigation, cache tenant-scoped data, and synchronize idempotent offline events.

**Architecture:** Create `mobile/` as an independent Expo application. Keep transport contracts in `mobile/src/api`, credentials behind a storage interface, and offline state in SQLite repositories. Add a versioned `/api/mobile/v1` backend surface whose sync endpoint acknowledges immutable client events by idempotency key.

**Tech stack:** Expo SDK 57, Expo Router, TypeScript strict mode, TanStack Query, Zustand, Expo SecureStore, Expo SQLite, Zod, Jest, React Native Testing Library, MSW, Vitest, Express, Prisma.

**Spec:** `docs/superpowers/specs/2026-08-28-lernvo-native-mobile-design.md`

## Task 1: Scaffold the native workspace

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/eas.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/babel.config.js`
- Create: `mobile/metro.config.js`
- Create: `mobile/jest.config.js`
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/index.tsx`
- Create: `mobile/src/config/env.ts`
- Create: `mobile/src/config/env.test.ts`
- Modify: `package.json`

1. Write failing tests proving environment parsing rejects a missing/invalid API URL and accepts development/staging values.
2. Run `npm test --prefix mobile -- env.test.ts` and confirm failure because the parser does not exist.
3. Add the minimal Expo Router shell and Zod-backed public environment parser. Do not add secrets to `EXPO_PUBLIC_*` values.
4. Add root scripts `dev:mobile`, `test:mobile`, `typecheck:mobile`, `mobile:ios`, and `mobile:android`.
5. Run the environment test, TypeScript check, and `npx expo-doctor`.
6. Commit: `feat(mobile): scaffold native Expo workspace`.

## Task 2: Define mobile API contracts and error semantics

**Files:**
- Create: `mobile/src/api/contracts.ts`
- Create: `mobile/src/api/errors.ts`
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/api/client.test.ts`
- Create: `backend/src/routes/mobile.ts`
- Create: `backend/src/test/mobileContract.test.ts`
- Modify: `backend/src/index.ts`

1. Write client tests for tenant headers, bearer injection, JSON parsing, request IDs, network errors, 401 refresh signaling, 409 conflicts, and redacted error objects.
2. Write backend contract tests for `GET /api/mobile/v1/bootstrap` returning a versioned envelope and rejecting unauthenticated/cross-tenant access.
3. Run both focused suites and confirm they fail.
4. Implement `MobileEnvelope<T>`, `MobileApiError`, an injectable fetch client, and the authenticated bootstrap route.
5. Keep the bootstrap response minimal: current user, tenant branding, roles/capabilities, feature flags, and server time.
6. Run focused tests plus `npm run build --prefix backend` and the mobile typecheck.
7. Commit: `feat(mobile-api): add versioned bootstrap contract`.

## Task 3: Implement secure authentication lifecycle

**Files:**
- Create: `mobile/src/auth/credentialStore.ts`
- Create: `mobile/src/auth/secureCredentialStore.ts`
- Create: `mobile/src/auth/authService.ts`
- Create: `mobile/src/auth/authStore.ts`
- Create: `mobile/src/auth/authService.test.ts`
- Create: `mobile/app/(auth)/sign-in.tsx`
- Modify: `mobile/app/_layout.tsx`
- Modify: `backend/src/routes/auth.ts`
- Create: `backend/src/test/mobileRefresh.test.ts`

1. Test sign-in with `tenantSlug`, token persistence through an injected credential store, one-at-a-time refresh, rotation, sign-out deletion, and forced logout after refresh rejection.
2. Add a backend regression test demonstrating rotating refresh tokens remain tenant-bound for the mobile client.
3. Confirm focused tests fail before implementation.
4. Implement the storage interface with Expo SecureStore and an in-memory test double; never expose raw token state to Zustand persistence or logs.
5. Implement a native sign-in screen with keyboard-safe layout, accessible errors, loading/disabled states, and tenant-aware copy.
6. Verify auth tests, backend auth tests, lint/typecheck, and manual cold-start restoration in development builds.
7. Commit: `feat(mobile): add secure tenant-aware authentication`.

## Task 4: Build role-aware native navigation

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/today.tsx`
- Create: `mobile/app/(tabs)/learn.tsx`
- Create: `mobile/app/(tabs)/ask.tsx`
- Create: `mobile/app/(tabs)/inbox.tsx`
- Create: `mobile/app/(tabs)/me.tsx`
- Create: `mobile/app/team/index.tsx`
- Create: `mobile/src/navigation/capabilities.ts`
- Create: `mobile/src/navigation/capabilities.test.ts`

1. Test tab definitions, learner defaults, capability-derived Team access, deep-link rejection for unauthorized roles, and sign-in/app route selection.
2. Implement native tabs with platform icons, safe areas, screen-reader labels, and no hidden web navigation.
3. Add a role-gated Team entry from Today/Me and guard direct route access.
4. Verify navigation tests and render tests; manually inspect tab behavior on both platforms.
5. Commit: `feat(mobile): add native role-aware navigation`.

## Task 5: Create the tenant-scoped local database

**Files:**
- Create: `mobile/src/storage/database.ts`
- Create: `mobile/src/storage/migrations/001_initial.ts`
- Create: `mobile/src/storage/repositories/bootstrapRepository.ts`
- Create: `mobile/src/storage/repositories/eventOutboxRepository.ts`
- Create: `mobile/src/storage/repositories/repository.test.ts`
- Create: `mobile/src/storage/tenantPartition.ts`

1. Test schema creation, forward-only migrations, tenant/user partition keys, transactional bootstrap replacement, FIFO outbox reads, acknowledgements, retry metadata, and account wipe.
2. Confirm tests fail against missing repositories.
3. Implement SQLite adapters behind narrow interfaces; tests may use an in-memory SQLite database, never mocked SQL strings.
4. Store cached content and event payloads only under composite tenant/user keys. Keep credentials outside SQLite.
5. Verify repository tests and simulate migration from an empty database twice to prove idempotency.
6. Commit: `feat(mobile): add tenant-scoped offline storage`.

## Task 6: Add idempotent event ingestion to the backend

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_mobile_event_ingestion/migration.sql`
- Create: `backend/src/services/mobileEventIngestion.ts`
- Modify: `backend/src/routes/mobile.ts`
- Create: `backend/src/test/mobileEventIngestion.test.ts`

1. Write tests for first ingestion, exact duplicate acknowledgement, conflicting duplicate rejection, tenant isolation, content-version retention, batch partial failure, and stable server sequence numbers.
2. Add Prisma models for immutable mobile learning events and per-user synchronization cursors, including a tenant-scoped unique idempotency constraint.
3. Implement `POST /api/mobile/v1/sync/events` with Zod limits, per-event results, a transaction, and no client authority over compliance/certificate fields.
4. Verify migration generation, Prisma client generation, focused tests, cross-tenant suite, and backend build.
5. Commit: `feat(sync): ingest idempotent mobile learning events`.

## Task 7: Implement the mobile sync coordinator

**Files:**
- Create: `mobile/src/sync/types.ts`
- Create: `mobile/src/sync/syncCoordinator.ts`
- Create: `mobile/src/sync/syncCoordinator.test.ts`
- Create: `mobile/src/sync/connectivity.ts`
- Create: `mobile/src/sync/useSyncStatus.ts`
- Modify: `mobile/app/(tabs)/today.tsx`

1. Use a fake clock and fake transport to test enqueue, single-flight sync, FIFO batching, exponential backoff with jitter bounds, exact duplicate acknowledgements, poison-event quarantine, cancellation, foreground reconnect, and account changes during sync.
2. Implement the coordinator against repository and transport interfaces, not React components.
3. Expose a small sync status model (`offline`, `syncing`, `upToDate`, `attentionRequired`) and accessible user actions for retry/details.
4. Run tests with randomized duplicate/reordering cases and the mobile typecheck.
5. Commit: `feat(mobile): add resilient offline sync coordinator`.

## Task 8: Add CI and developer verification

**Files:**
- Create: `.github/workflows/mobile-ci.yml`
- Create: `mobile/README.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_CONTEXT.md`

1. Configure CI for dependency installation, mobile unit tests, mobile typecheck, Expo Doctor, backend mobile contract tests, Prisma validation, and backend build.
2. Document Node/Xcode/Android prerequisites, environment setup, development builds, tests, simulator/emulator commands, and secret-handling boundaries.
3. Run every CI command locally where platform tooling permits; record any simulator-only checks explicitly.
4. Update project context with completed commits, evidence, and the first reinforcement-engine task.
5. Commit: `ci(mobile): enforce foundation quality gates`.

## Foundation exit gate

- A fresh checkout installs without undocumented manual steps.
- iOS and Android development builds reach sign-in and native tabs.
- Auth survives cold start via SecureStore and reliably wipes on sign-out.
- An offline event synchronizes once after reconnect; a duplicate is acknowledged without duplicate effects.
- Tenant isolation and existing backend regression suites pass.
- No credentials appear in SQLite, AsyncStorage, logs, snapshots, or source control.
