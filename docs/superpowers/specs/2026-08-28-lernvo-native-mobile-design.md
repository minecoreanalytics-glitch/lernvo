# Lernvo Native Mobile and Reinforcement Platform Design

**Date:** 2026-08-28  
**Status:** Approved in design review  
**Target:** iOS and Android  
**Product model:** Multi-tenant frontline enablement, comparable to Axonify rather than a conventional mobile LMS

## 1. Objective

Build a true native Lernvo application for iOS and Android that helps frontline employees learn, find trusted answers, receive operational communications, complete work, and improve knowledge every day. The mobile product must include a personalized reinforcement engine, secure offline operation, manager coaching workflows, tenant branding, push notifications, and reliable synchronization with Lernvo's existing multi-tenant backend.

The app is not a wrapper around the React website. It consumes versioned Lernvo APIs and renders native screens, controls, navigation, gestures, transitions, downloads, notifications, and offline states.

## 2. Product Principles

1. **Daily usefulness over feature parity.** The home experience answers “what needs my attention now?” rather than reproducing the website menu.
2. **Frontline-first.** Employee and manager workflows are optimized for short sessions, intermittent connectivity, and one-handed use.
3. **Approved knowledge only.** Reinforcement and AI answers must cite an approved source and its exact version.
4. **Explainable personalization.** Mastery and scheduling decisions are deterministic and auditable. AI may create drafts but cannot silently determine compliance.
5. **Offline by design.** Required learning, reinforcement, communications, and tasks remain usable during network loss.
6. **Tenant isolation everywhere.** Server, device database, encrypted files, push registration, analytics, and logs carry explicit tenant boundaries.
7. **One Lernvo app first.** A universal app serves every tenant through access codes, links, QR codes, or tenant discovery. White-label editions use configuration, never source forks.
8. **Web and mobile have different jobs.** Mobile supports frontline execution and fast manager actions. Complex authoring, imports, integrations, and analytics remain web-first.

## 3. Market-Informed Positioning

Axonify's mature mobile pattern combines personalized daily training, knowledge access, communications, tasks, games, rewards, and individual progress. Lernvo will follow that frontline-enablement structure while differentiating through approved knowledge versioning, source-grounded AI, tenant isolation, and explicit acknowledgment evidence.

The common enterprise mobile distribution pattern is one multi-tenant app with optional branded builds. Lernvo will use runtime tenant branding in the universal app and preserve build-time configuration for future enterprise white-label packages.

## 4. Architecture

### 4.1 Mobile client

- React Native 0.86 through stable Expo SDK 57
- TypeScript with strict mode
- Expo Router using stable stack and tab primitives
- React Native Reanimated and Gesture Handler for native transitions and gestures
- TanStack Query for server-state coordination
- Zustand for bounded client state such as session UI and preferences
- Expo SQLite for structured offline data
- Expo SecureStore for refresh tokens and local encryption keys
- Expo FileSystem for managed downloads
- Expo Notifications with APNs and FCM credentials managed through EAS
- Expo BackgroundTask for best-effort background synchronization
- EAS Build, Submit, Update, Workflows, and production observability
- React Native Testing Library for component tests and Maestro for device-level flows

The mobile workspace will live at `mobile/` inside the existing Lernvo repository. It will not import web React components or browser-specific stores. Shared request/response schemas may later move into a platform-neutral `packages/contracts/` package once the first mobile API contract is stable.

### 4.2 Backend

The existing Express, Prisma, PostgreSQL, and Redis application remains the system of record. New mobile routes live under `/api/mobile/v1`. The reinforcement engine is a bounded backend domain with routes, services, scheduling logic, and tests. It does not become a separate microservice during the first release.

Redis supports short-lived session assembly, rate limiting, work queues, and synchronization locks. PostgreSQL stores all durable learning events, source versions, mastery state, devices, packs, tasks, and audit evidence.

### 4.3 Administration

The existing web application gains focused administration for:

- Knowledge-topic taxonomy
- Reinforcement question authoring and approval
- Source and version linkage
- Role, department, location, and tenant targeting
- Business criticality and KPI tags
- Daily-session policy
- Manager coaching policies
- Mobile device and release controls
- Offline eligibility and content revocation

## 5. Native Information Architecture

The main employee navigation contains five tabs.

### Today

- Personalized daily reinforcement session
- Priority announcement or acknowledgment
- Assigned operational task
- Recommended learning based on a knowledge gap
- Visible sync and offline state
- Daily progress, streak, and reward feedback

### Learn

- Assigned and available modules
- Career and onboarding paths
- Quizzes and assignments
- Downloaded content
- Certificates
- Progress and deadlines

### Ask

- Source-grounded Lernvo assistant
- Search across approved procedures, products, pricing, and troubleshooting
- Visible citations and source versions
- Cached offline search across explicitly downloaded knowledge
- “I still need help” escalation or feedback action

### Inbox

- Announcements
- Reminders
- Required acknowledgments
- Coaching messages
- Assignment and quiz results
- Push-notification history

### Me

- Mastery by topic
- Strengths and knowledge gaps
- Confidence calibration
- Points, streaks, badges, and leaderboard context
- Certificates
- Downloads and storage controls
- Language, accessibility, privacy, and device settings

Managers and supervisors receive a role-aware Team workspace reachable from Today and Me. It shows coaching priorities, overdue work, low-confidence topics, acknowledgment gaps, and achievements. It supports reminders, coaching records, assigning existing content, limited approvals, and task review.

## 6. Daily Session

A normal daily session lasts three to five minutes and contains a server-assembled mixture of:

1. Due reinforcement questions
2. A recently changed or critical knowledge item
3. A weak-topic question
4. Limited exploration of a new topic
5. A required announcement or acknowledgment when present
6. An operational task or suggested module when present

Before submitting each reinforcement answer, the employee declares confidence on a three-level scale: unsure, somewhat sure, or confident. Feedback includes the correct response, concise explanation, and approved source link. High-confidence errors receive stronger remediation than uncertain errors.

The session must be resumable after app termination, network loss, or device restart. Points and streaks shown offline are provisional until the server confirms the event batch.

## 7. Reinforcement Domain

### 7.1 New durable models

- `KnowledgeTopic`: hierarchical competency or knowledge unit scoped to a tenant
- `ReinforcementItem`: stable identity for a reinforcement prompt
- `ReinforcementItemVersion`: immutable prompt, explanation, options, difficulty, and approved source-version snapshot
- `ReinforcementTarget`: role, department, company unit, location, or explicit-user targeting
- `ReinforcementAttempt`: append-only response event with correctness, confidence, response time, item version, source version, device, and offline metadata
- `UserTopicMastery`: current server-derived mastery state for one user and topic
- `DailySession`: assembled session identity, policy version, state, and completion evidence
- `DailySessionItem`: ordered, versioned item in a daily session
- `MobileDevice`: installation identity, push token, platform, app version, tenant, user, and revocation state
- `SyncEvent`: idempotent incoming mobile event envelope and processing outcome
- `OfflinePack`: signed manifest, included content versions, expiry, and revocation state
- `OperationalTask`: tenant-scoped frontline task or checklist
- `OperationalTaskAttempt`: append-only completion and evidence event
- `CoachingRecord`: manager coaching observation, topic, action, and follow-up date

Existing `Quiz`, `Question`, and `QuizAttempt` models remain responsible for course assessment. Reinforcement items may be created from approved quiz questions through an explicit copy operation, but the two domains do not share mutable rows.

### 7.2 Mastery state

For each user-topic pair, the engine stores:

- Mastery score from 0 to 100
- Evidence count and evidence weight
- Confidence calibration score
- Last exposure and last correct response
- Current review interval
- Next review timestamp
- Consecutive correct and incorrect counts
- Current source version
- State reason codes for explainability

### 7.3 Deterministic update rules

The first engine uses configurable deterministic rules rather than an opaque model.

- Correct, confident, timely responses increase mastery most.
- Correct but uncertain responses increase mastery modestly.
- Incorrect confident responses decrease mastery most and shorten the interval.
- Incorrect uncertain responses trigger remediation without the same overconfidence penalty.
- Repeated correct responses expand intervals through 1, 3, 7, 14, 30, and 60-day bands.
- Long periods without evidence apply gradual decay based on topic criticality.
- New approved source versions cap inherited mastery and schedule a fresh review.
- Critical topics have a lower maximum interval than non-critical topics.
- Manager-assigned topics temporarily receive elevated scheduling priority.

Every mastery update records reason codes and the engine-policy version. Historical mastery can therefore be reconstructed from attempt events.

### 7.4 Session selection

Candidate priority combines:

- Review due status
- Low or decaying mastery
- Confidence mismatch
- Business criticality
- Source recency
- Manager assignment
- Required-topic coverage
- Exploration quota
- Recent-item suppression

The initial session policy reserves most items for due and weak knowledge, while limiting changed-critical content and exploration so employees are not overwhelmed. Exact weights live in a versioned tenant policy and are validated through simulation before production rollout.

### 7.5 AI boundary

AI may:

- Draft questions from approved content
- Suggest distractors and explanations
- Classify topics
- Propose difficulty and targeting
- Summarize knowledge gaps for managers

AI may not:

- Publish items without human approval
- Change mastery directly
- Issue certificates
- Mark compliance complete
- Invent uncited employee guidance
- Hide the source and policy behind a recommendation

## 8. Tenant Discovery and Authentication

The universal Lernvo app supports:

- Employer-provided access code
- QR code or universal link
- Tenant URL or slug
- Invitation link
- Verified email/password flow that offers a tenant choice only after credentials are proven

After tenant identification, the app loads branding and authentication policy from a public bootstrap endpoint. The mobile API receives the tenant slug explicitly and validates it against the authenticated token. Mobile requests do not depend exclusively on the HTTP `Host` header because the universal app is not running at a tenant subdomain.

Access tokens remain short-lived. Rotating refresh tokens are stored only in Keychain or Keystore. Each installation has a random device identifier and server registration. Administrators can revoke one device without ending every user session. Password changes and account deactivation revoke all devices.

SSO is implemented through system-browser authorization with PKCE when a tenant enables it. SSO tokens are exchanged for Lernvo tokens and are not retained.

## 9. Offline Storage and Downloads

Expo SQLite stores structured cached data. Sensitive payload fields are encrypted with AES-GCM using an installation key held in SecureStore. Downloaded files are encrypted with per-file keys derived from the installation key and manifest identifier. The operating-system application sandbox remains an additional protection layer.

Offline packs contain:

- Session and reinforcement item versions
- Required announcements and acknowledgments
- Operational tasks
- Module metadata and explicitly downloaded lesson assets
- Cached approved knowledge chosen for offline availability
- Signed manifest, hashes, expiry, and source-version identifiers

The app validates signatures and hashes before activation. Corrupt packs are discarded and redownloaded. Tenant switching, logout, remote device revocation, or account deactivation destroys keys and removes tenant data.

Users control downloads, Wi-Fi-only behavior, and storage limits. Required offline material can be policy-managed by a tenant, but the app always displays storage impact.

## 10. Synchronization Protocol

The mobile client maintains two durable streams.

### Inbox

Server-to-device changes use a monotonic cursor and include content updates, revocations, assignments, announcements, tasks, branding, policy changes, and push-linked entities.

### Outbox

Device-to-server events are append-only envelopes containing:

- Event UUID
- Event type and schema version
- Tenant, user, and device identifiers
- Device occurrence time and local sequence number
- Entity and version identifiers
- Payload hash
- Offline and connectivity metadata

The server stores the event UUID before processing. Repeated delivery returns the original outcome and cannot duplicate progress, points, acknowledgments, or attempts.

Foreground synchronization runs on launch, resume, login, reconnect, manual refresh, and after important writes. Background synchronization is best-effort because both mobile operating systems may delay execution.

Conflict rules are domain-specific:

- Append-only attempts and acknowledgments merge without last-write-wins.
- Profile and preference edits use server version checks and explicit conflict responses.
- Old reinforcement attempts remain historical when a source changes, but cannot satisfy the new source version.
- Course progress uses monotonic completion semantics where possible.
- Compliance and certification results are provisional offline and server-authoritative after grading.
- Revocations always win over cached availability.

## 11. Notifications and Deep Links

The app registers APNs or FCM tokens per device. Push payloads contain a safe title, event identifier, and navigation target but no sensitive procedure, score, or employee details. The app authenticates and fetches protected content after opening.

Supported deep links include tenant bootstrap, daily session, module, lesson, announcement, task, acknowledgment, certificate, manager coaching item, and Ask result. Universal links and Android App Links are configured for `lernvo.com` and tenant invite URLs.

Notification preferences support mandatory operational events, optional engagement reminders, quiet hours, and tenant policy. Critical security revocations bypass normal in-app preferences while remaining subject to operating-system controls.

## 12. Feature Scope

### Native frontline coverage

- Today experience and daily reinforcement
- Modules, lessons, quizzes, assignments, downloads, and progress
- Career and onboarding paths
- Knowledge base and approved-source assistant
- Announcements, acknowledgments, tasks, and notifications
- Certificates, points, streaks, badges, and mastery profile
- Pricing and product knowledge where enabled by the tenant
- Audio, video, PDF, text, and presentation consumption
- French and English from the first pilot

### Native manager coverage

- Team readiness and knowledge gaps
- Employees requiring coaching
- Coaching records and follow-ups
- Reminders
- Assignment of existing modules and tasks
- Acknowledgment coverage
- Assignment review and limited approvals
- Department and company-unit comparisons

### Web-first coverage

- Complex course and content authoring
- Bulk imports and exports
- HRIS and external integration configuration
- Tenant and security administration
- Advanced report construction
- Full analytics and audit exploration
- Reinforcement-policy simulation and bulk question management

## 13. Error Handling and Recovery

Every screen has explicit loading, empty, offline, stale, permission-denied, and retry states. User actions are never silently dropped.

- Recoverable writes enter the outbox and display pending state.
- Permanent validation failures display a specific resolution and preserve user-entered evidence where safe.
- Authentication failures pause synchronization and require reauthentication without deleting valid offline work.
- Device revocation immediately locks protected content and removes local keys.
- Low storage pauses downloads before corruption and offers cleanup choices.
- Interrupted downloads resume by byte range when the server supports it or restart safely.
- Unsupported content opens through an authenticated system-browser handoff and is labeled online-only.
- Server policy or schema incompatibility triggers a controlled mandatory update screen.

## 14. Security and Privacy

- Tenant context is validated from both token and explicit mobile tenant identifier.
- Mobile endpoints use the existing fail-closed Prisma tenant context.
- Refresh tokens and encryption keys never enter AsyncStorage, logs, analytics, or crash reports.
- Logs use opaque identifiers and redact request bodies by default.
- Offline data is encrypted and wiped on tenant change, logout, device revocation, or account deactivation.
- Certificate and compliance outcomes require server confirmation.
- Download URLs are short-lived and device-authorized.
- Rate limits distinguish device, user, tenant, and IP risk.
- Mobile releases include Apple privacy manifests, Android Data Safety declarations, account-deletion handling, and documented retention.
- Device attestation may be activated for high-risk tenants after the base flow is stable; it is not required for the first pilot.

## 15. Testing Strategy

### Reinforcement tests

- Golden mastery histories with exact expected scores and intervals
- Confidence and overconfidence effects
- Difficulty and criticality handling
- Source-version changes
- Decay and long inactivity
- Deterministic replay from append-only events
- Session composition fairness and recent-item suppression

### Backend tests

- Tenant isolation on every new model and route
- Device registration and revocation
- Token rotation and reuse rejection
- Sync idempotency and duplicate batches
- Cursor progression and revocation precedence
- Provisional compliance behavior
- Pack signing, expiry, and corruption detection
- Backward-compatible mobile contract fixtures

### Mobile tests

- Component and accessibility behavior
- Native navigation and deep links
- Tenant bootstrap and authentication
- Daily session completion
- Downloads and offline playback
- Outbox persistence across termination
- Reconnection and duplicate synchronization
- Low-storage and corrupted-pack recovery
- Tenant switching and secure wipe
- Push navigation
- French and English layouts

### Device coverage

Automated and manual verification covers current supported iOS devices, small and large iPhones, representative low/mid/high Android devices, tablets, slow networks, airplane mode, low storage, app backgrounding, and operating-system process termination.

## 16. Observability and Operations

- Crash-free session rate by app version and platform
- Startup and screen-interaction performance
- Sync success, latency, retry, duplicate, and permanent-failure rates
- Offline pack download, activation, expiry, and corruption rates
- Push delivery and open rates without sensitive payload logging
- Daily-session start, completion, duration, and abandonment
- Mastery change by topic and cohort
- Announcement acknowledgment coverage
- Manager coaching follow-through
- Server dashboards for mobile API health and event backlog

Feature flags control reinforcement, offline quizzes, manager tools, tasks, shared-device mode, and AI-assisted drafting. Mobile APIs remain versioned. Security releases may enforce a minimum supported application version.

## 17. Rollout

### Foundation release

Establish the mobile workspace, native design system, navigation, tenant bootstrap, authentication, mobile API, device registration, encrypted storage, synchronization framework, and automated builds.

### Frontline beta

Deliver Today, Learn, Ask, Inbox, Me, daily reinforcement, modules, offline packs, push notifications, announcements, acknowledgments, tasks, progress, gamification, and bilingual support.

### Manager and operations beta

Deliver team readiness, coaching, reminders, task review, assignment of existing content, acknowledgment coverage, and limited approvals.

### Broad coverage and hardening

Deliver career paths, onboarding, certificates, richer media, pricing knowledge, tablet layouts, shared-device mode, store compliance, accessibility hardening, and production telemetry.

The pilot begins with one tenant and a controlled employee group. Expansion proceeds department by department after two weeks of stable crash and synchronization metrics. Manager coaching activates only after learner events are reliable enough for decisions.

## 18. Success Criteria

- At least 99.5% of synchronization cycles complete without manual intervention
- At least 99.8% crash-free sessions
- Interactive app startup within three seconds on supported pilot devices
- Typical daily reinforcement completion within three to five minutes
- At least 70% weekly pilot participation
- Demonstrable topic-mastery improvement after four weeks
- Push-to-open and acknowledgment coverage are measurable
- No cross-tenant data exposure
- No final compliance or certificate state created solely offline
- Every mastery change and manager recommendation is explainable from stored evidence and policy version

## 19. Explicit Non-Goals for the First Production Release

- Rebuilding the full desktop administration suite on mobile
- Separate source forks for customer-branded applications
- AI-controlled compliance or certification
- Real-time collaborative course authoring
- Replacing the existing web application
- A new microservice topology for reinforcement
- Guaranteed background execution when iOS or Android suspends the app

## 20. Key Risks and Mitigations

- **Scope expansion:** ship vertical releases behind feature flags and preserve web-first boundaries.
- **Offline conflicts:** use append-only events, idempotency, versioned content, and domain-specific merge rules.
- **Sensitive cached content:** encrypt fields and files, isolate tenants, and support remote revocation.
- **Untrusted mastery logic:** keep rules deterministic, versioned, simulated, and replayable.
- **Notification fatigue:** use tenant policy, quiet hours, event priority, and user preferences.
- **Low-end device performance:** paginate aggressively, cap pack size, test representative Android hardware, and measure startup continuously.
- **Store delays:** begin signing, privacy, screenshots, and internal tracks during foundation work rather than at the end.
- **Backend regressions:** isolate mobile contracts under `/api/mobile/v1` and retain compatibility fixtures.

## 21. Final Decisions

- React Native with stable Expo SDK 57
- Universal Lernvo app with runtime tenant branding
- Configuration-ready white-label builds later
- Axonify-style daily frontline experience
- Personalized reinforcement included in the initial product program
- Deterministic mastery engine with AI limited to reviewed assistance
- Secure offline learning and event synchronization
- Broad learner coverage, focused manager actions, complex administration on web
- Continuous internal iOS and Android builds throughout implementation

## 22. Implementation Plan Decomposition

This design spans several dependent subsystems and will be executed through separate plans rather than one unreviewable task list. Each plan must end in independently demonstrable software.

1. **Mobile foundation and secure synchronization:** repository workspace, design system, native navigation, tenant bootstrap, authentication, device registration, encrypted storage, outbox/inbox protocol, CI, and an internal installable shell.
2. **Reinforcement engine and web administration:** knowledge taxonomy, versioned items, targeting, mastery calculation, session assembly, simulation, approval workflow, mobile contracts, and an API-demonstrable daily session.
3. **Frontline native experience:** Today, Learn, Ask, Inbox, Me, offline packs, media, quizzes, progress, announcements, acknowledgments, tasks, notifications, deep links, and a complete employee beta.
4. **Manager and operational experience:** team readiness, knowledge gaps, coaching, reminders, task review, content assignment, acknowledgment coverage, limited approvals, and manager pilot activation.
5. **Production hardening and store release:** accessibility, localization, tablet and low-end Android behavior, shared-device mode, security validation, observability, performance, privacy declarations, store assets, staged rollout, and production release controls.

The plans execute in this order. A later plan may begin only when the interfaces it consumes have passed the acceptance tests defined by the earlier plan.
