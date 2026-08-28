import * as SecureStore from 'expo-secure-store';

import type { CredentialBundle, CredentialStore } from './credentialStore';

const credentialKey = 'lernvo.auth.credentials.v1';

export const secureCredentialStore: CredentialStore = {
  async load() {
    const serialized = await SecureStore.getItemAsync(credentialKey);
    if (!serialized) return null;

    try {
      return JSON.parse(serialized) as CredentialBundle;
    } catch {
      await SecureStore.deleteItemAsync(credentialKey);
      return null;
    }
  },
  async save(value) {
    await SecureStore.setItemAsync(credentialKey, JSON.stringify(value), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async clear() {
    await SecureStore.deleteItemAsync(credentialKey);
  },
};
