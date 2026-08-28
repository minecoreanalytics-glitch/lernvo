import type { AuthTransport } from './authService';
import type { CredentialBundle } from './credentialStore';

export class AuthTransportError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthTransportError';
    this.status = status;
  }

  toJSON() {
    return { name: this.name, status: this.status, message: this.message };
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;
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
      return post<CredentialBundle>('login', input);
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
