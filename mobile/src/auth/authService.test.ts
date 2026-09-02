import { describe, expect, it } from 'vitest';

import { createAuthService, type AuthTransport } from './authService';
import type { CredentialBundle, CredentialStore } from './credentialStore';

class MemoryCredentialStore implements CredentialStore {
  value: CredentialBundle | null = null;

  async load() {
    return this.value;
  }

  async save(value: CredentialBundle) {
    this.value = value;
  }

  async clear() {
    this.value = null;
  }
}

const signedIn: CredentialBundle = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  tenantSlug: 'acme',
  user: {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'learner@acme.test',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'AGENT',
  },
};

function transport(overrides: Partial<AuthTransport> = {}): AuthTransport {
  return {
    signIn: async () => signedIn,
    refresh: async () => ({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    }),
    signOut: async () => undefined,
    ...overrides,
  };
}

describe('auth service', () => {
  it('signs in with the selected tenant and stores the complete credential bundle', async () => {
    const store = new MemoryCredentialStore();
    let received: unknown;
    const service = createAuthService({
      store,
      transport: transport({
        signIn: async (input) => {
          received = input;
          return signedIn;
        },
      }),
    });

    const session = await service.signIn({
      email: 'Learner@Acme.test ',
      password: 'correct horse battery staple',
      tenantSlug: 'ACME ',
    });

    expect(received).toEqual({
      email: 'learner@acme.test',
      password: 'correct horse battery staple',
      tenantSlug: 'acme',
    });
    expect(session).toEqual(signedIn);
    expect(store.value).toEqual(signedIn);
  });

  it('restores a cold-start session from secure storage', async () => {
    const store = new MemoryCredentialStore();
    store.value = signedIn;
    const service = createAuthService({ store, transport: transport() });

    await expect(service.restore()).resolves.toEqual(signedIn);
    await expect(service.getAccessToken()).resolves.toBe('access-1');
    await expect(service.getTenantSlug()).resolves.toBe('acme');
  });

  it('coalesces concurrent refreshes and persists the rotated tokens once', async () => {
    const store = new MemoryCredentialStore();
    store.value = signedIn;
    let refreshCalls = 0;
    const service = createAuthService({
      store,
      transport: transport({
        refresh: async () => {
          refreshCalls += 1;
          await Promise.resolve();
          return { accessToken: 'access-2', refreshToken: 'refresh-2' };
        },
      }),
    });

    const [first, second] = await Promise.all([
      service.refreshAccessToken(),
      service.refreshAccessToken(),
    ]);

    expect(first).toBe('access-2');
    expect(second).toBe('access-2');
    expect(refreshCalls).toBe(1);
    expect(store.value).toEqual({
      ...signedIn,
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    });
  });

  it('clears credentials when refresh is rejected', async () => {
    const store = new MemoryCredentialStore();
    store.value = signedIn;
    const service = createAuthService({
      store,
      transport: transport({
        refresh: async () => {
          throw new Error('refresh rejected');
        },
      }),
    });

    await expect(service.refreshAccessToken()).rejects.toThrow(
      'refresh rejected',
    );
    expect(store.value).toBeNull();
    await expect(service.getAccessToken()).resolves.toBeNull();
  });

  it('clears local credentials even when remote sign-out is unavailable', async () => {
    const store = new MemoryCredentialStore();
    store.value = signedIn;
    const service = createAuthService({
      store,
      transport: transport({
        signOut: async () => {
          throw new Error('offline');
        },
      }),
    });

    await service.signOut();

    expect(store.value).toBeNull();
  });
});
