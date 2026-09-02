# Lernvo native app: App Store and Google Play release runbook

Last updated: 2026-09-02

This is the operational checklist to take the Expo/React Native app in `mobile/`
from the repository to TestFlight, the App Store, and Google Play. It separates
what is already done from what requires the account owner's credentials, which
must never be typed by an agent.

## 1. What is in place

| Area | State |
|---|---|
| App identity | Name `Lernvo`, slug `lernvo`, bundle id / package `com.minecore.lernvo`, scheme `lernvo` |
| EAS project | `@tbijou/lernvo`, id `90319661-35ba-47b7-b461-3e7bcee601a5` (https://expo.dev/accounts/tbijou/projects/lernvo) |
| Icons | `mobile/assets/icon.png` (iOS 1024), adaptive icon + monochrome layer (Android), splash mark, generated from the brand mark by `docs/brand/gen.py` geometry |
| Splash | Dark `#0E1116` ground, amber mark, via `expo-splash-screen` plugin |
| Languages | French and English, resolved from the device language at startup (`mobile/src/i18n`) |
| Privacy | No camera, microphone or storage permission requested; `ITSAppUsesNonExemptEncryption = false`; credentials in Keychain / Keystore only |
| Build profiles | `mobile/eas.json`: `development` (dev client, iOS simulator), `preview` (internal APK / ad-hoc IPA), `production` (store: AAB + App Store IPA). All point at `https://lernvo.com` |
| Backend | `/api/mobile/v1/*` deployed on lernvo.com (see PROJECT_CONTEXT.md for the deploy record) |
| CI | `.github/workflows/mobile-ci.yml`: unit tests, typecheck, expo-doctor, iOS and Android JS bundles, backend contract tests |

## 2. One-time account setup (owner only)

These steps need Apple and Google credentials. Do them from your own terminal;
EAS stores the resulting certificates and keys in its credential vault.

### Apple

1. Confirm the Apple Developer Program membership is active for the team that
   owns the `Apple Development: thierry bijou` certificates on this Mac.
2. In App Store Connect create the app record:
   platform iOS, name `Lernvo`, primary language French (Canada) or French,
   bundle id `com.minecore.lernvo`, SKU `lernvo-ios`.
3. Copy the numeric App Store Connect app id into `mobile/eas.json`
   (`submit.production.ios.ascAppId`).
4. First store build (interactive, EAS asks for your Apple ID and creates the
   distribution certificate and provisioning profile):

```bash
cd mobile && npx eas build --platform ios --profile production
```

5. Upload to TestFlight:

```bash
cd mobile && npx eas submit --platform ios --latest
```

### Google

1. Create the app in Google Play Console: `Lernvo`, default language French,
   app (not game), free.
2. Create a service account with "Release manager" access to the app, download
   its JSON key, save it as `mobile/google-play-service-account.json`
   (already gitignored; never commit it).
3. First production build (EAS generates and stores the upload keystore):

```bash
cd mobile && npx eas build --platform android --profile production
```

4. The very first AAB must be uploaded manually in Play Console (internal
   testing track) to create the app's signing key. Every later release can use:

```bash
cd mobile && npx eas submit --platform android --latest --track internal
```

## 3. Internal test builds (no store accounts needed)

```bash
# Android APK, installable on any device (EAS generates a debug keystore on first run)
cd mobile && npx eas build --platform android --profile preview

# iOS simulator build of the dev client
cd mobile && npx eas build --platform ios --profile development
```

## 4. Store listing (draft copy)

**Subtitle / short description**

- FR: Vos procédures, vos formations, vos preuves. Dans votre poche.
- EN: Your procedures, your training, your proof. In your pocket.

**Description**

FR:
Lernvo est l'application de votre entreprise pour apprendre et retrouver la
bonne information au travail. Chaque jour, l'onglet Aujourd'hui vous propose la
formation ou le quiz à faire en priorité. Formations, parcours, documents et
procédures approuvés sont consultables en quelques gestes. L'assistant répond à
vos questions en s'appuyant uniquement sur les connaissances validées par votre
entreprise et cite ses sources. Les annonces importantes arrivent dans votre
boîte et vous confirmez les avoir lues. Vos points, votre série et vos
certificats vous suivent. Connexion avec le code de votre entreprise et vos
identifiants habituels.

EN:
Lernvo is your company's app for learning and finding the right answer at
work. Every day, the Today tab shows the training or quiz to do first.
Approved modules, paths, documents and procedures are a tap away. The
assistant answers your questions using only knowledge your company has
approved, and cites its sources. Important announcements land in your inbox
and you confirm you have read them. Your points, streak and certificates follow
you. Sign in with your company code and your usual credentials.

**Keywords (iOS, 100 chars)**: formation,procédures,employés,quiz,connaissance,entreprise,training,frontline,onboarding

**Category**: Education (secondary: Business)

**Age rating**: 4+ / Everyone. No user-generated public content, no ads, no purchases.

**Privacy policy URL**: https://lernvo.com/privacy (must be live before submission).

**Data safety / App privacy answers**: collects account identifiers (email,
name), learning activity (progress, quiz results) linked to the user; used for
app functionality only; encrypted in transit; users can request deletion through
their employer's platform manager. No tracking, no third-party advertising SDK.

**Demo account for reviewers**: create a dedicated reviewer user in a demo
tenant (for example `acme-demo` / `agent@acme.demo`) with a fresh password and
give the reviewer the company code, email and password in the review notes.
Never reuse a customer tenant.

## 5. Screenshots

Take them from the iOS Simulator (iPhone 17 = 6.3", plus a 6.9" device) and an
Android emulator, in French, after signing in to the demo tenant:
Today, Learn (Formations), Docs (Documents), a document, a quiz, Me.
Required sizes: iOS 6.9" (1320×2868) and 6.3" (1206×2622); Android phone
16:9 or 9:16 at least 1080 px on the short side, plus a 512×512 icon and a
1024×500 feature graphic.

## 6. Release gates

Before each store submission:

- [ ] `npm test` and `npm run typecheck` in `mobile/` green; `npx expo-doctor` clean
- [ ] Backend suite green (`npm test` in `backend/`, `DOMAIN` unset)
- [ ] Sign in, Today, Learn, Docs, Ask, Inbox, Me verified against lernvo.com on a physical device
- [ ] French and English checked by switching the device language
- [ ] Airplane mode: cached screens still render, outbox syncs on reconnect
- [ ] Sign out wipes credentials (relaunch lands on sign-in)
- [ ] Version bumped in `app.json` (`version`); build numbers auto-increment remotely
- [ ] Privacy policy URL live; reviewer demo account working
