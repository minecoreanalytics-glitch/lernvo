import type { CredentialBundle, CredentialStore } from './credentialStore';

export type SignInInput = Readonly<{
  email: string;
  password: string;
  tenantSlug: string;
}>;

export interface AuthTransport {
  signIn(input: SignInInput): Promise<CredentialBundle>;
  refresh(input: {
    refreshToken: string;
    tenantSlug: string;
  }): Promise<{ accessToken: string; refreshToken: string }>;
  signOut(input: {
    accessToken: string;
    refreshToken: string;
    tenantSlug: string;
  }): Promise<void>;
}

export function createAuthService(options: {
  store: CredentialStore;
  transport: AuthTransport;
}) {
  let session: CredentialBundle | null | undefined;
  let refreshPromise: Promise<string> | null = null;

  async function restore() {
    if (session === undefined) session = await options.store.load();
    return session;
  }

  async function signIn(input: SignInInput) {
    const authenticated = await options.transport.signIn({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      tenantSlug: input.tenantSlug.trim().toLowerCase(),
    });
    await options.store.save(authenticated);
    session = authenticated;
    return authenticated;
  }

  async function refreshAccessToken() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      const current = await restore();
      if (!current) throw new Error('No authenticated session');

      try {
        const rotated = await options.transport.refresh({
          refreshToken: current.refreshToken,
          tenantSlug: current.tenantSlug,
        });
        const updated = { ...current, ...rotated };
        await options.store.save(updated);
        session = updated;
        return updated.accessToken;
      } catch (error) {
        await options.store.clear();
        session = null;
        throw error;
      }
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  async function signOut() {
    const current = await restore();
    try {
      if (current) await options.transport.signOut(current);
    } catch {
      // Local sign-out must always succeed, including while offline.
    } finally {
      await options.store.clear();
      session = null;
    }
  }

  return {
    signIn,
    restore,
    refreshAccessToken,
    signOut,
    async getAccessToken() {
      return (await restore())?.accessToken ?? null;
    },
    async getTenantSlug() {
      return (await restore())?.tenantSlug ?? null;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
