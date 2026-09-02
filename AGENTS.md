# Lernvo Agent Guide

## Canonical context

Before changing Lernvo mobile code, read these files in order:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/superpowers/specs/2026-08-28-lernvo-native-mobile-design.md`
3. The relevant plan in `docs/superpowers/plans/`

The approved direction is a native React Native + Expo application for iOS and Android. Do not reintroduce Capacitor, a WebView shell, or web-style navigation as the mobile architecture.

## Execution rules

- Preserve the existing React/Vite web application and Express/Prisma backend while adding the native client and shared contracts deliberately.
- Build mobile features test-first and keep commits scoped to a plan task.
- Treat the server as authoritative for compliance, credentials, certificates, and final scoring.
- Keep offline mutations idempotent and append-only until acknowledged by the server.
- Store mobile credentials in platform-secure storage, never AsyncStorage.
- AI may draft or explain learning content; it may not determine compliance status or scored outcomes.
- Update `docs/PROJECT_CONTEXT.md` after meaningful implementation milestones or changed decisions.
- Never commit secrets, signing credentials, provisioning profiles, service-account files, or production environment values.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

