# Lernvo native mobile app

Native iOS and Android client for Lernvo, built with Expo SDK 57 and React Native. It is not a
Capacitor or WebView wrapper: it consumes the versioned `/api/mobile/v1` backend and renders
native screens in French or English (device language).

Learner tabs: Today (daily session), Learn (assigned modules and paths), Docs (approved
documents and procedures), Ask (source-grounded assistant), Inbox (announcements to
acknowledge), Me (profile, points, streak, certificates). Managers also get a Team screen.

## Prerequisites

- Node.js `22.13+` or `24.3+`
- macOS with Xcode 26+ for iOS development (CocoaPods installed by `expo run:ios`)
- Android Studio with Android SDK 36 for local Android builds (cloud builds through EAS need no SDK)
- A running Lernvo API and a tenant account

Minimum supported platforms: iOS 16.4 and Android 7.

## Setup

```bash
npm install
cp .env.example .env.local
npm start
```

Use `127.0.0.1` for the iOS Simulator. For the Android Emulator, set
`EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`. Production and shared environments must use HTTPS.
To test against the live platform, set `EXPO_PUBLIC_API_URL=https://lernvo.com` and sign in with
your company slug (for example the `htv` in `htv.lernvo.com`).

Local development builds (Continuous Native Generation; `ios/` and `android/` are gitignored):

```bash
npm run ios
npm run android
```

After adding or upgrading a native module, regenerate the native projects:

```bash
npx expo prebuild --platform all --no-install
```

### Checkout inside iCloud Drive (macOS)

If the repository lives under `~/Documents` with iCloud Drive enabled, iCloud stamps extended
attributes on freshly built frameworks and Xcode's codesign step fails with
"resource fork, Finder information, or similar detritus not allowed" (seen in the
`[CP-User] Build ExpoModulesJSI xcframework` phase). Workarounds, in order of preference:

1. Clone or `git worktree add` outside iCloud (for example `~/dev/lernvo`).
2. Before building, clear the attributes and retry:

```bash
xattr -cr ios/Pods node_modules/expo-modules-jsi && npm run ios
```

EAS cloud builds are not affected.

## Verification

```bash
npm test
npm run typecheck
npx expo-doctor
EXPO_PUBLIC_API_URL=https://api.example.com npx expo export --platform ios --output-dir dist-ios
EXPO_PUBLIC_API_URL=https://api.example.com npx expo export --platform android --output-dir dist-android
```

## Builds and store release

EAS project: `@tbijou/lernvo`. Profiles live in `eas.json` (`development`, `preview`,
`production`). The full App Store / Google Play runbook, including the owner-only credential
steps and the store listing copy, is in `docs/mobile/STORE_RELEASE.md`.

```bash
npx eas build --platform android --profile preview   # internal APK
npx eas build --platform ios --profile production    # App Store build (asks for Apple ID)
```

## Localization

`src/i18n/messages.ts` holds the French and English catalogue; `src/i18n/index.ts` resolves the
device language once at startup. A unit test enforces key and placeholder parity between the two
languages. Add new copy to both dictionaries.

## Security boundaries

- Access and rotating refresh tokens are stored only through Expo SecureStore.
- SQLite contains tenant/user-partitioned cache data and queued learning events, never credentials.
- Only `EXPO_PUBLIC_*` non-secret configuration may be bundled into the application.
- Signing credentials, provisioning profiles, service-account JSON, and push credentials must
  remain in EAS or CI secret storage.
- The server is authoritative for compliance, certification, mastery, and final scores.

## Offline sync

Learning mutations enter the SQLite outbox with a stable client event ID and content version. The
coordinator synchronizes FIFO batches, acknowledges exact duplicates, quarantines rejected poison
events, and retries transient failures with bounded exponential backoff. Account changes cancel
application of in-flight acknowledgements.

The tenant is selected at sign-in and sent as `x-lernvo-tenant`.
