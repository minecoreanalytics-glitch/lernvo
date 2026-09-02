import { describe, expect, it } from 'vitest';

import { createAuthStore } from './authStore';
import type { AuthService } from './authService';

const session = {
  accessToken: 'must-not-enter-ui-state',
  refreshToken: 'must-not-enter-ui-state-either',
  tenantSlug: 'acme',
  user: {
    id: 'u1',
    tenantId: 'tenant-1',
    email: 'ada@acme.test',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'AGENT' as const,
  },
};

describe('auth UI store', () => {
  it('restores only public session state and never exposes tokens', async () => {
    const service = {
      restore: async () => session,
    } as unknown as AuthService;
    const store = createAuthStore(service);

    await store.getState().initialize();

    expect(store.getState()).toMatchObject({
      status: 'authenticated',
      tenantSlug: 'acme',
      user: session.user,
    });
    expect(JSON.stringify(store.getState())).not.toContain('must-not-enter-ui-state');
  });

  it('returns to signed-out state after failed sign-in', async () => {
    const service = {
      signIn: async () => {
        throw new Error('Invalid credentials');
      },
    } as unknown as AuthService;
    const store = createAuthStore(service);

    await expect(
      store.getState().signIn({
        email: 'ada@acme.test',
        password: 'wrong',
        tenantSlug: 'acme',
      }),
    ).rejects.toThrow('Invalid credentials');
    expect(store.getState()).toMatchObject({
      status: 'signedOut',
      error: 'Invalid credentials',
    });
  });
});
