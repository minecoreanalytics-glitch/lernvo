import { describe, expect, it } from 'vitest';

import { createMobileApiClient } from './client';
import { MobileApiError } from './errors';

const successEnvelope = {
  apiVersion: '1',
  data: { ready: true },
  requestId: 'server-request-id',
  serverTime: '2026-08-28T16:00:00.000Z',
};

describe('mobile API client', () => {
  it('sends tenant, bearer, JSON, and request tracing headers', async () => {
    let received: Request | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      received = new Request(input, init);
      return Response.json(successEnvelope);
    };
    const client = createMobileApiClient({
      baseUrl: 'https://api.lernvo.com/',
      getAccessToken: () => 'secret-access-token',
      getTenantSlug: () => 'acme-training',
      createRequestId: () => 'client-request-id',
      fetchImpl,
    });

    const data = await client.request<{ ready: boolean }>('/bootstrap');

    expect(data).toEqual({ ready: true });
    expect(received?.url).toBe(
      'https://api.lernvo.com/api/mobile/v1/bootstrap',
    );
    expect(received?.headers.get('authorization')).toBe(
      'Bearer secret-access-token',
    );
    expect(received?.headers.get('x-lernvo-tenant')).toBe('acme-training');
    expect(received?.headers.get('x-request-id')).toBe('client-request-id');
    expect(received?.headers.get('accept')).toBe('application/json');
  });

  it('signals that authentication must refresh after a 401', async () => {
    const client = createMobileApiClient({
      baseUrl: 'https://api.lernvo.com',
      getAccessToken: () => 'expired-token',
      getTenantSlug: () => 'acme',
      createRequestId: () => 'request-401',
      fetchImpl: async () =>
        Response.json(
          { error: { code: 'UNAUTHORIZED', message: 'Expired' } },
          { status: 401 },
        ),
    });

    await expect(client.request('/bootstrap')).rejects.toMatchObject({
      name: 'MobileApiError',
      code: 'AUTH_REFRESH_REQUIRED',
      status: 401,
      requestId: 'request-401',
    });
  });

  it('preserves conflict details without exposing credentials', async () => {
    const client = createMobileApiClient({
      baseUrl: 'https://api.lernvo.com',
      getAccessToken: () => 'never-log-this-token',
      getTenantSlug: () => 'acme',
      createRequestId: () => 'request-409',
      fetchImpl: async () =>
        Response.json(
          {
            error: {
              code: 'EVENT_CONFLICT',
              message: 'Event payload differs',
              details: { eventId: 'evt-1' },
            },
          },
          { status: 409 },
        ),
    });

    const error = await client.request('/sync/events').catch((caught) => caught);

    expect(error).toBeInstanceOf(MobileApiError);
    expect(error).toMatchObject({
      code: 'EVENT_CONFLICT',
      status: 409,
      details: { eventId: 'evt-1' },
    });
    expect(JSON.stringify(error)).not.toContain('never-log-this-token');
    expect(String(error)).not.toContain('never-log-this-token');
  });

  it('turns transport failures into a retryable redacted error', async () => {
    const client = createMobileApiClient({
      baseUrl: 'https://api.lernvo.com',
      getAccessToken: () => 'private-token',
      getTenantSlug: () => 'acme',
      createRequestId: () => 'offline-request',
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch https://private-token@host');
      },
    });

    await expect(client.request('/bootstrap')).rejects.toMatchObject({
      code: 'NETWORK_UNAVAILABLE',
      retryable: true,
      requestId: 'offline-request',
      message: 'Unable to reach Lernvo',
    });
  });

  it('rejects malformed success envelopes', async () => {
    const client = createMobileApiClient({
      baseUrl: 'https://api.lernvo.com',
      getAccessToken: () => null,
      getTenantSlug: () => null,
      createRequestId: () => 'malformed-request',
      fetchImpl: async () => Response.json({ ready: true }),
    });

    await expect(client.request('/bootstrap')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      retryable: false,
    });
  });

  it('retries once after refreshing an expired access token', async () => {
    const tokens = ['expired-token', 'fresh-token'];
    const calls: string[] = [];
    const client = createMobileApiClient({
      baseUrl: 'https://api.lernvo.com',
      getAccessToken: () => tokens[0] ?? null,
      getTenantSlug: () => 'acme',
      refreshAccessToken: async () => {
        tokens[0] = 'fresh-token';
        return 'fresh-token';
      },
      createRequestId: () => 'request-refresh',
      fetchImpl: async (input, init) => {
        const request = new Request(input, init);
        calls.push(request.headers.get('authorization') ?? '');
        if (request.headers.get('authorization') === 'Bearer expired-token') {
          return Response.json(
            { error: { code: 'UNAUTHORIZED', message: 'Expired' } },
            { status: 401 },
          );
        }
        return Response.json(successEnvelope);
      },
    });

    await expect(client.request('/bootstrap')).resolves.toEqual({ ready: true });
    expect(calls).toEqual(['Bearer expired-token', 'Bearer fresh-token']);
  });

  it('maps a 409 tenant selection response', async () => {
    const client = createMobileApiClient({
      baseUrl: 'https://api.lernvo.com',
      getAccessToken: () => 'token',
      getTenantSlug: () => null,
      createRequestId: () => 'request-need-tenant',
      fetchImpl: async () =>
        Response.json(
          { needTenant: true, tenants: [{ slug: 'acme', name: 'Acme' }] },
          { status: 409 },
        ),
    });

    await expect(client.request('/bootstrap')).rejects.toMatchObject({
      code: 'NEED_TENANT',
      status: 409,
    });
  });
});
