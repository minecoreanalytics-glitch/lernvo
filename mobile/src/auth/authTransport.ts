import type { AuthTransport } from './authService';
import type { CredentialBundle } from './credentialStore';

export type TenantChoice = Readonly<{ slug: string; name: string }>;

export class AuthTransportError extends Error {
  readonly status: number;
  readonly needTenant: boolean;
  readonly tenants: TenantChoice[];

  constructor(
    status: number,
    message: string,
    options: { needTenant?: boolean; tenants?: TenantChoice[] } = {},
  ) {
    super(message);
    this.name = 'AuthTransportError';
    this.status = status;
    this.needTenant = options.needTenant === true;
    this.tenants = options.tenants ?? [];
  }

  toJSON() {
    return {
      name: this.name,
      status: this.status,
      message: this.message,
      needTenant: this.needTenant,
    };
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    needTenant?: boolean;
    tenants?: TenantChoice[];
  } & T;
  if (response.status === 409 && body.needTenant) {
    throw new AuthTransportError(409, 'Select your company to continue', {
      needTenant: true,
      tenants: Array.isArray(body.tenants) ? body.tenants : [],
    });
  }
  if (!response.ok) {
    throw new AuthTransportError(
      response.status,
      typeof body.error === 'string' ? body.error : 'Authentication failed',
    );
  }
  return body;
}

export function createHttpAuthTransport(options: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): AuthTransport {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;

  async function post<T>(
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) {
    const response = await fetchImpl(`${baseUrl}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  return {
    async signIn(input) {
      const payload: Record<string, string> = {
        email: input.email,
        password: input.password,
      };
      if (input.tenantSlug) payload.tenantSlug = input.tenantSlug;
      return post<CredentialBundle>('login', payload);
    },
    async refresh(input) {
      return post<{ accessToken: string; refreshToken: string }>(
        'refresh',
        { refreshToken: input.refreshToken },
        { 'x-lernvo-tenant': input.tenantSlug },
      );
    },
    async signOut(input) {
      await post<{ message: string }>(
        'logout',
        { refreshToken: input.refreshToken },
        {
          authorization: `Bearer ${input.accessToken}`,
          'x-lernvo-tenant': input.tenantSlug,
        },
      );
    },
  };
}
