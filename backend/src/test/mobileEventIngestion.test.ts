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

const suffix = Date.now();
let tenantId = '';
let otherTenantId = '';
let userId = '';

function token(claimTenantId = tenantId) {
  return jwt.sign(
    {
      userId,
      email: `events-${suffix}@lernvo.test`,
      role: 'AGENT',
      tenantId: claimTenantId,
      departmentId: null,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '15m', algorithm: 'HS256', issuer: 'lernvo', audience: 'api' },
  );
}

const event = {
  clientEventId: `event-${suffix}-1`,
  eventType: 'ANSWER_SUBMITTED',
  occurredAt: '2026-08-28T16:00:00.000Z',
  contentId: 'question-1',
  contentVersion: 4,
  payload: { answerId: 'answer-b', confidence: 0.7 },
};

beforeAll(async () => {
  await tenantStore.run({ tenantId: null, superAdmin: true }, async () => {
    const tenant = await prisma.tenant.create({
      data: { name: `Events ${suffix}`, slug: `events-${suffix}`, status: 'ACTIVE' },
    });
    const other = await prisma.tenant.create({
      data: { name: `Events Other ${suffix}`, slug: `events-other-${suffix}`, status: 'ACTIVE' },
    });
    const user = await prisma.user.create({
      data: {
        email: `events-${suffix}@lernvo.test`,
        passwordHash: 'not-used',
        firstName: 'Event',
        lastName: 'Learner',
        role: 'AGENT',
        isActive: true,
        tenantId: tenant.id,
      },
    });
    tenantId = tenant.id;
    otherTenantId = other.id;
    userId = user.id;
  });
});

async function sync(events: unknown[], bearer = token()) {
  return request(app)
    .post('/api/mobile/v1/sync/events')
    .set('Authorization', `Bearer ${bearer}`)
    .send({ events });
}

describe('mobile learning event ingestion', () => {
  it('assigns stable sequence numbers and acknowledges exact duplicates', async () => {
    const first = await sync([event]);
    expect(first.status).toBe(200);
    expect(first.body.data.results).toEqual([
      {
        clientEventId: event.clientEventId,
        status: 'accepted',
        serverSequence: 1,
      },
    ]);

    const duplicate = await sync([event]);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.data.results).toEqual([
      {
        clientEventId: event.clientEventId,
        status: 'duplicate',
        serverSequence: 1,
      },
    ]);
  });

  it('rejects a conflicting reuse of a client event ID', async () => {
    const conflict = await sync([
      { ...event, payload: { answerId: 'answer-c', confidence: 0.9 } },
    ]);

    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({
      error: {
        code: 'EVENT_CONFLICT',
        message: 'Client event ID was already used with different data',
        details: { clientEventId: event.clientEventId },
      },
    });
  });

  it('accepts valid batch items while rejecting client-authored compliance state', async () => {
    const validId = `event-${suffix}-valid-batch`;
    const forbiddenId = `event-${suffix}-forbidden-batch`;
    const response = await sync([
      {
        ...event,
        clientEventId: validId,
        eventType: 'SESSION_COMPLETED',
        payload: { durationSeconds: 180 },
      },
      {
        ...event,
        clientEventId: forbiddenId,
        payload: { complianceStatus: 'PASSED' },
      },
    ]);

    expect(response.status).toBe(200);
    expect(response.body.data.results).toEqual([
      { clientEventId: validId, status: 'accepted', serverSequence: 2 },
      {
        clientEventId: forbiddenId,
        status: 'rejected',
        code: 'SERVER_AUTHORITY_REQUIRED',
      },
    ]);
  });

  it('cannot ingest through a forged cross-tenant access token', async () => {
    const response = await sync(
      [{ ...event, clientEventId: `event-${suffix}-forged` }],
      token(otherTenantId),
    );

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });
});
