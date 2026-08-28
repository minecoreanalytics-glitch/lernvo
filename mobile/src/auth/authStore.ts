import { createStore } from 'zustand/vanilla';

import type { AuthService, SignInInput } from './authService';
import type { AuthenticatedUser } from './credentialStore';

type AuthStatus = 'checking' | 'signedOut' | 'signingIn' | 'authenticated';

export type AuthState = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  tenantSlug: string | null;
  error: string | null;
  initialize(): Promise<void>;
  signIn(input: SignInInput): Promise<void>;
  signOut(): Promise<void>;
};

export function createAuthStore(service: AuthService) {
  return createStore<AuthState>((set) => ({
    status: 'checking',
    user: null,
    tenantSlug: null,
    error: null,
    async initialize() {
      const session = await service.restore();
      set(
        session
          ? {
              status: 'authenticated',
              user: session.user,
              tenantSlug: session.tenantSlug,
              error: null,
            }
          : { status: 'signedOut', user: null, tenantSlug: null, error: null },
      );
    },
    async signIn(input) {
      set({ status: 'signingIn', error: null });
      try {
        const session = await service.signIn(input);
        set({
          status: 'authenticated',
          user: session.user,
          tenantSlug: session.tenantSlug,
          error: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign-in failed';
        set({ status: 'signedOut', user: null, tenantSlug: null, error: message });
        throw error;
      }
    },
    async signOut() {
      await service.signOut();
      set({ status: 'signedOut', user: null, tenantSlug: null, error: null });
    },
  }));
}
