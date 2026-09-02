import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import mobileRoutes from '../routes/mobile';
import { prisma } from '../utils/prisma';
import { tenantStore } from '../utils/tenantContext';

const app = express();
app.use(express.json());
app.use('/api/mobile/v1', mobileRoutes);

const secret = process.env.JWT_SECRET!;
const suffix = Date.now();
let tenantId = '';
let otherTenantId = '';
let userId = '';

function accessToken(overrides: Partial<{ userId: string; tenantId: string }> = {}) {
  return jwt.sign(
    {
      userId: overrides.userId ?? userId,
      email: `mobile-${suffix}@lernvo.test`,
      role: 'AGENT',
      tenantId: overrides.tenantId ?? tenantId,
      departmentId: null,
    },
    secret,
    { expiresIn: '15m', algorithm: 'HS256', issuer: 'lernvo', audience: 'api' },
  );
}

beforeAll(async () => {
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Mobile ${suffix}`,
        slug: `mobile-${suffix}`,
        status: 'ACTIVE',
        primaryColor: '#123B2A',
      },
    });
    const otherTenant = await prisma.tenant.create({
      data: {
        name: `Other ${suffix}`,
        slug: `other-${suffix}`,
        status: 'ACTIVE',
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `mobile-${suffix}@lernvo.test`,
        passwordHash: 'not-used',
        firstName: 'Mobile',
        lastName: 'Learner',
        role: 'AGENT',
        isActive: true,
        tenantId: tenant.id,
      },
    });
    tenantId = tenant.id;
    otherTenantId = otherTenant.id;
    userId = user.id;
  });
});

describe('GET /api/mobile/v1/bootstrap', () => {
  it('rejects an unauthenticated request', async () => {
    const response = await request(app).get('/api/mobile/v1/bootstrap');

    expect(response.status).toBe(401);
  });

  it('returns the minimal versioned tenant bootstrap envelope', async () => {
    const response = await request(app)
      .get('/api/mobile/v1/bootstrap')
      .set('Authorization', `Bearer ${accessToken()}`)
      .set('X-Request-Id', 'mobile-contract-request');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      apiVersion: '1',
      requestId: 'mobile-contract-request',
      serverTime: expect.any(String),
      data: {
        currentUser: {
          id: userId,
          email: `mobile-${suffix}@lernvo.test`,
          firstName: 'Mobile',
          lastName: 'Learner',
          avatarUrl: null,
          role: 'AGENT',
          departmentId: null,
        },
        tenant: {
          id: tenantId,
          name: `Mobile ${suffix}`,
          slug: `mobile-${suffix}`,
          logoUrl: null,
          primaryColor: '#123B2A',
          supportEmail: null,
        },
        capabilities: ['learn', 'ask', 'inbox'],
        featureFlags: {},
      },
    });
  });

  it('does not return a user through a forged cross-tenant claim', async () => {
    const response = await request(app)
      .get('/api/mobile/v1/bootstrap')
      .set(
        'Authorization',
        `Bearer ${accessToken({ tenantId: otherTenantId })}`,
      );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'BOOTSTRAP_NOT_FOUND', message: 'Account not found' },
    });
  });
});
