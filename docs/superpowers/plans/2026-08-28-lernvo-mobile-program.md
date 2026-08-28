# Lernvo Native Mobile Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended when explicitly authorized) or superpowers:executing-plans to implement each plan. Use superpowers:test-driven-development for every behavior change.

**Goal:** Deliver store-ready native Lernvo apps for iOS and Android, centered on short personalized daily learning, reliable offline use, and role-aware frontline workflows.

**Architecture:** Add an Expo/React Native client beside the existing Vite client. Extend the Express/Prisma backend with versioned mobile APIs, append-only learning events, deterministic reinforcement services, and idempotent sync. Keep compliance and credentials server-authoritative.

**Tech stack:** Expo SDK 57, React Native, Expo Router, TypeScript, TanStack Query, Zustand, SecureStore, SQLite, Vitest/Jest, React Native Testing Library, Maestro, Express, Prisma, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-08-28-lernvo-native-mobile-design.md`

## Global constraints

- Do not embed the web app, introduce Capacitor, or mimic desktop navigation.
- Use platform-secure credential storage and redact authentication material from telemetry/logging.
- Attach a client event ID and content version to every offline learning mutation.
- Make replay safe under duplicate delivery and interrupted synchronization.
- AI output is advisory or draft content; deterministic code owns mastery, scoring, compliance, and certification.
- Validate each workstream independently before beginning a dependent workstream.

## Workstream order

| Order | Plan | Depends on | Exit outcome |
|---:|---|---|---|
| 1 | `2026-08-28-lernvo-mobile-foundation.md` | Existing auth/API | App boots, authenticates, persists securely, and synchronizes a tested event queue |
| 2 | `2026-08-28-lernvo-reinforcement-engine.md` | Foundation contracts | Server produces deterministic daily sessions and records mastery evidence |
| 3 | `2026-08-28-lernvo-frontline-experience.md` | Foundation + engine | Today/Learn/Ask/Inbox/Me flows work online and offline |
| 4 | `2026-08-28-lernvo-manager-experience.md` | Operational APIs | Managers can act on team exceptions and frontline workflows |
| 5 | `2026-08-28-lernvo-production-hardening.md` | Complete feature set | Accessibility, observability, E2E, security, signing, and store release gates pass |

## Release milestones

1. Internal developer build: foundation workstream complete on iOS Simulator and Android Emulator.
2. Employee alpha: Today session plus cached learning and basic inbox.
3. Manager beta: Team exceptions, assignments, acknowledgements, and push routing.
4. Store candidate: all hardening gates pass with staged rollout controls.

## Completion evidence

- Unit and contract suites pass for mobile and backend.
- Offline/online replay and duplicate-delivery tests pass.
- Maestro critical journeys pass on both platforms.
- Accessibility and reduced-motion review has no release-blocking findings.
- App Store Connect and Google Play internal-track builds install and authenticate against staging.

