import { isMobileEnvelope, type MobileErrorBody } from './contracts';
import { MobileApiError } from './errors';

type MaybePromise<T> = T | Promise<T>;

export type MobileApiClientOptions = Readonly<{
  baseUrl: string;
  getAccessToken: () => MaybePromise<string | null>;
  getTenantSlug: () => MaybePromise<string | null>;
  createRequestId?: () => string;
  fetchImpl?: typeof fetch;
}>;

export type MobileRequestInit = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

export function createMobileApiClient(options: MobileApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const createRequestId = options.createRequestId ?? (() => crypto.randomUUID());

  return {
    async request<T>(path: string, init: MobileRequestInit = {}): Promise<T> {
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
          `${baseUrl}/api/mobile/v1/${path.replace(/^\/+/, '')}`,
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
        const errorBody = (body ?? {}) as MobileErrorBody;
        const serverError = errorBody.error;
        throw new MobileApiError({
          code:
            response.status === 401
              ? 'AUTH_REFRESH_REQUIRED'
              : (serverError?.code ?? `HTTP_${response.status}`),
          message: serverError?.message ?? 'Lernvo request failed',
          requestId: response.headers.get('x-request-id') ?? requestId,
          retryable: response.status >= 500 || response.status === 429,
          status: response.status,
          details: serverError?.details,
        });
      }

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
    },
  };
}

export type MobileApiClient = ReturnType<typeof createMobileApiClient>;
