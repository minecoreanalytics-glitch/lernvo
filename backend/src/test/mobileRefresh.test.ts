import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import authRoutes from '../routes/auth';
import { hashPassword } from '../utils/password';
import { prisma } from '../utils/prisma';
import { tenantStore } from '../utils/tenantContext';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

const suffix = Date.now();
const password = 'StrongMobilePassword123!';
const email = `mobile-refresh-${suffix}@lernvo.test`;
const tenantSlug = `mobile-refresh-${suffix}`;

beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const tenant = await prisma.tenant.create({
      data: { name: 'Mobile Refresh', slug: tenantSlug, status: 'ACTIVE' },
    });
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Mobile',
        lastName: 'Refresh',
        role: 'AGENT',
        isActive: true,
        tenantId: tenant.id,
      },
    });
  });
});

describe('mobile refresh tenant binding', () => {
  it('rejects the wrong mobile tenant and rotates tokens for the correct tenant', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password, tenantSlug });
    expect(login.status).toBe(200);

    const wrongTenant = await request(app)
      .post('/api/auth/refresh')
      .set('X-Lernvo-Tenant', 'another-company')
      .send({ refreshToken: login.body.refreshToken });
    expect(wrongTenant.status).toBe(401);

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .set('X-Lernvo-Tenant', tenantSlug)
      .send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);

    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('X-Lernvo-Tenant', tenantSlug)
      .send({ refreshToken: login.body.refreshToken });
    expect(replay.status).toBe(401);
  });
});
