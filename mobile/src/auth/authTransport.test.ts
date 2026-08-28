import { describe, expect, it } from 'vitest';

import { createHttpAuthTransport } from './authTransport';

describe('HTTP auth transport', () => {
  it('sends tenant-aware sign-in and returns a secure credential bundle', async () => {
    let requestBody: unknown;
    const auth = createHttpAuthTransport({
      baseUrl: 'https://api.lernvo.com/',
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          accessToken: 'access',
          refreshToken: 'refresh',
          tenantSlug: 'acme',
          user: {
            id: 'u1',
            email: 'learner@acme.test',
            firstName: 'Ada',
            lastName: 'Lovelace',
            role: 'AGENT',
          },
        });
      },
    });

    await expect(
      auth.signIn({
        email: 'learner@acme.test',
        password: 'secret',
        tenantSlug: 'acme',
      }),
    ).resolves.toMatchObject({ tenantSlug: 'acme', accessToken: 'access' });
    expect(requestBody).toEqual({
      email: 'learner@acme.test',
      password: 'secret',
      tenantSlug: 'acme',
    });
  });

  it('binds refresh to the stored tenant slug', async () => {
    let received: Request | undefined;
    const auth = createHttpAuthTransport({
      baseUrl: 'https://api.lernvo.com',
      fetchImpl: async (input, init) => {
        received = new Request(input, init);
        return Response.json({
          accessToken: 'access-2',
          refreshToken: 'refresh-2',
        });
      },
    });

    await auth.refresh({ refreshToken: 'refresh-1', tenantSlug: 'acme' });

    expect(received?.headers.get('x-lernvo-tenant')).toBe('acme');
    expect(await received?.json()).toEqual({ refreshToken: 'refresh-1' });
  });

  it('returns a safe authentication error without echoing the password', async () => {
    const auth = createHttpAuthTransport({
      baseUrl: 'https://api.lernvo.com',
      fetchImpl: async () =>
        Response.json({ error: 'Invalid credentials' }, { status: 401 }),
    });

    const error = await auth
      .signIn({
        email: 'learner@acme.test',
        password: 'never-echo-me',
        tenantSlug: 'acme',
      })
      .catch((caught) => caught);

    expect(error).toMatchObject({
      name: 'AuthTransportError',
      status: 401,
      message: 'Invalid credentials',
    });
    expect(JSON.stringify(error)).not.toContain('never-echo-me');
  });
});
