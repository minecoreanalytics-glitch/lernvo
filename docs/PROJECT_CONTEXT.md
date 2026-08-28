# Lernvo Project Context

Last updated: 2026-08-28 12:56 EDT

## Current objective

Build production-quality native iOS and Android apps for Lernvo while preserving the existing web administration and backend. The experience should feel native and frontline-first, closer to Axonify than a conventional course catalog.

## Approved decisions

- React Native with Expo SDK 57 is the mobile platform; Capacitor and WebView shells are rejected.
- Primary learner navigation: Today, Learn, Ask, Inbox, Me.
- Managers receive a role-gated Team workspace without turning the learner experience into a desktop dashboard.
- The Today surface drives a short personalized daily session using deterministic mastery and spaced-repetition rules.
- AI can draft, summarize, translate, and explain. Deterministic services own scoring, compliance, mastery, and certification.
- Offline support uses encrypted/secure local persistence, an inbox/outbox sync model, idempotency keys, append-only learning events, and server conflict resolution.
- The backend remains authoritative for compliance and certificate state.
- Delivery is organized into five workstreams: foundation/sync, reinforcement/admin, frontline experience, manager experience, and production/store hardening.

## Source of truth

- Approved product and architecture spec: `docs/superpowers/specs/2026-08-28-lernvo-native-mobile-design.md`
- Git commit containing the approved spec: `441e94c`
- Active planning branch: `codex/lernvo-mobile-planning`
- GitHub repository: `https://github.com/minecoreanalytics-glitch/lernvo`

## Current implementation state

- Existing codebase: React 18/Vite PWA in `frontend/`, Express/Prisma API in `backend/`.
- Native mobile application: foundation implemented on `codex/lernvo-mobile-foundation`.
- Completed commits: Expo scaffold `fc5286f`; API contract `18995b9`; secure auth `dfe6930`; native navigation `aa1f9ea`; SQLite storage `a6f2042`; server ingestion `b6eb410`; sync coordinator `8b2a6b8`.
- Verification: 41 mobile unit/integration tests pass; mobile TypeScript passes; focused mobile API plus cross-tenant backend suites pass; backend TypeScript build passes.
- The mobile app now has SecureStore authentication, Today/Learn/Ask/Inbox/Me tabs, guarded Team access, tenant-partitioned SQLite cache/outbox, versioned bootstrap and sync APIs, and foreground/connectivity-driven synchronization.
- Next execution target: deterministic reinforcement engine and web administration plan.

## Non-negotiable invariants

- No secrets or tokens in logs, source control, AsyncStorage, or analytics.
- No client-only grant of compliance, certificate, or final score.
- Offline event replay must be safe under retries and duplicate delivery.
- Every learning event records source/content version so audits remain reproducible.
- Accessibility, reduced motion, localization, and dynamic type are release requirements.

## Handoff protocol

At the end of a meaningful work unit, update this file with the completed milestone, branch/commit, verification evidence, and next executable task. Keep details in implementation plans and link them rather than duplicating them here.
