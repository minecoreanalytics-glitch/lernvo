export type AuthenticatedUser = Readonly<{
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'AGENT' | 'SUPERVISOR' | 'MANAGER' | 'HR' | 'PLATFORM_MANAGER' | 'SUPER_ADMIN';
}>;

export type CredentialBundle = Readonly<{
  accessToken: string;
  refreshToken: string;
  tenantSlug: string;
  user: AuthenticatedUser;
}>;

export interface CredentialStore {
  load(): Promise<CredentialBundle | null>;
  save(value: CredentialBundle): Promise<void>;
  clear(): Promise<void>;
}
