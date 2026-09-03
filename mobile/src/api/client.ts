import { isMobileEnvelope, type MobileErrorBody } from './contracts';
import { MobileApiError } from './errors';

type MaybePromise<T> = T | Promise<T>;

// React Native (Hermes) has no global `crypto` by default, so `crypto.randomUUID()`
// throws. Use it when present, otherwise fall back to an RFC-4122 v4 id.
function safeRandomUUID(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type MobileApiClientOptions = Readonly<{
  baseUrl: string;
  getAccessToken: () => MaybePromise<string | null>;
  getTenantSlug: () => MaybePromise<string | null>;
  refreshAccessToken?: () => MaybePromise<string | null>;
  createRequestId?: () => string;
  fetchImpl?: typeof fetch;
  /** URL prefix after the base URL. Defaults to the versioned mobile API. */
  basePath?: string;
  /** When false, the raw JSON body is returned (web API routes have no envelope). */
  envelope?: boolean;
}>;

export type MobileRequestInit = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

export function createMobileApiClient(options: MobileApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const createRequestId = options.createRequestId ?? safeRandomUUID;
  const basePath = (options.basePath ?? '/api/mobile/v1').replace(/\/+$/, '');
  const envelope = options.envelope ?? true;

  async function perform<T>(path: string, init: MobileRequestInit, retried: boolean): Promise<T> {
    const requestId = createRequestId();
    const [accessToken, tenantSlug] = await Promise.all([
      options.getAccessToken(),
      options.getTenantSlug(),
    ]);
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    headers.set('x-request-id', requestId);
    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
    if (tenantSlug) headers.set('x-lernvo-tenant', tenantSlug);
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    let response: Response;
    try {
      response = await fetchImpl(
        `${baseUrl}${basePath}/${path.replace(/^\/+/, '')}`,
        { ...init, headers },
      );
    } catch {
      throw new MobileApiError({
        code: 'NETWORK_UNAVAILABLE',
        message: 'Unable to reach Lernvo',
        requestId,
        retryable: true,
      });
    }

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const errorBody = (body ?? {}) as MobileErrorBody & { needTenant?: boolean };
      const serverError = errorBody.error;
      const needTenant =
        errorBody.needTenant === true || serverError?.code === 'NEED_TENANT';

      if (response.status === 401 && !retried && options.refreshAccessToken) {
        const refreshed = await options.refreshAccessToken();
        if (refreshed) {
          return perform<T>(path, init, true);
        }
      }

      throw new MobileApiError({
        code: needTenant
          ? 'NEED_TENANT'
          : response.status === 401
            ? 'AUTH_REFRESH_REQUIRED'
            : (serverError?.code ?? `HTTP_${response.status}`),
        message: serverError?.message ?? (needTenant ? 'Select your company to continue' : 'Lernvo request failed'),
        requestId: response.headers.get('x-request-id') ?? requestId,
        retryable: response.status >= 500 || response.status === 429,
        status: response.status,
        details: needTenant ? errorBody : serverError?.details,
      });
    }

    if (!envelope) return body as T;
    if (!isMobileEnvelope<T>(body)) {
      throw new MobileApiError({
        code: 'INVALID_RESPONSE',
        message: 'Lernvo returned an invalid response',
        requestId,
        retryable: false,
        status: response.status,
      });
    }

    return body.data;
  }

  return {
    async request<T>(path: string, init: MobileRequestInit = {}): Promise<T> {
      return perform<T>(path, init, false);
    },
  };
}

export type MobileApiClient = ReturnType<typeof createMobileApiClient>;
