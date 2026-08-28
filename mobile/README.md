# Lernvo native mobile app

This is the native iOS and Android client. It uses Expo SDK 57 and React Native; it is not a Capacitor or WebView wrapper.

## Prerequisites

- Node.js `22.13+` or `24.3+` (avoid odd-numbered Node releases)
- macOS with Xcode 26.4+ for iOS development
- Android Studio with Android SDK 36 for Android development
- A running Lernvo API and tenant account

The minimum supported platforms are iOS 16.4 and Android 7.

## Setup

```bash
npm install
cp .env.example .env.local
npm start
```

Use `127.0.0.1` for the iOS Simulator. For the Android Emulator, set `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`. Production and shared development environments must use HTTPS.

Create native development builds with:

```bash
npm run ios
npm run android
```

The app uses Expo prebuild/Continuous Native Generation. Do not hand-edit generated `ios/` or `android/` directories unless a documented native exception requires it.

## Verification

```bash
npm test
npm run typecheck
npx expo-doctor
EXPO_PUBLIC_API_URL=https://api.example.com npx expo export --platform ios --output-dir dist-ios
EXPO_PUBLIC_API_URL=https://api.example.com npx expo export --platform android --output-dir dist-android
```

## Security boundaries

- Access and rotating refresh tokens are stored only through Expo SecureStore.
- SQLite contains tenant/user-partitioned cache data and queued learning events, never credentials.
- Only `EXPO_PUBLIC_*` non-secret configuration may be bundled into the application.
- Signing credentials, provisioning profiles, service-account JSON, and push credentials must remain in EAS or CI secret storage.
- The server is authoritative for compliance, certification, mastery, and final scores.

## Offline sync

Learning mutations enter the SQLite outbox with a stable client event ID and content version. The coordinator synchronizes FIFO batches, acknowledges exact duplicates, quarantines rejected poison events, and retries transient failures with bounded exponential backoff. Account changes cancel application of in-flight acknowledgements.
