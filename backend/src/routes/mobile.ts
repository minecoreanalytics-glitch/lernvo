import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../middleware/auth';
import {
  ingestMobileEvents,
  MobileEventConflictError,
} from '../services/mobileEventIngestion';
import { prisma } from '../utils/prisma';

const router = Router();

const mobileEventSchema = z.object({
  clientEventId: z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  eventType: z.string().min(1).max(64).regex(/^[A-Z][A-Z0-9_]*$/),
  occurredAt: z.string().datetime(),
  contentId: z.string().min(1).max(128).optional(),
  contentVersion: z.number().int().positive().optional(),
  payload: z.record(z.unknown()),
}).strict();

const syncEventsSchema = z.object({ events: z.array(mobileEventSchema).min(1).max(50) }).strict();

const capabilitiesByRole = {
  AGENT: ['learn', 'ask', 'inbox'],
  SUPERVISOR: ['learn', 'ask', 'inbox', 'team'],
  MANAGER: ['learn', 'ask', 'inbox', 'team'],
  HR: ['learn', 'ask', 'inbox', 'team'],
  PLATFORM_MANAGER: ['learn', 'ask', 'inbox', 'team', 'admin'],
  SUPER_ADMIN: ['learn', 'ask', 'inbox', 'team', 'admin'],
} as const;

router.get('/bootstrap', authenticate, async (req, res) => {
  const requestIdHeader = req.header('x-request-id');
  const requestId =
    requestIdHeader && /^[A-Za-z0-9._:-]{1,128}$/.test(requestIdHeader)
      ? requestIdHeader
      : randomUUID();

  const user = await prisma.user.findFirst({
    where: { id: req.user!.userId, isActive: true },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      departmentId: true,
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          primaryColor: true,
          supportEmail: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({
      error: { code: 'BOOTSTRAP_NOT_FOUND', message: 'Account not found' },
    });
  }

  const { tenant, ...currentUser } = user;
  res.setHeader('x-request-id', requestId);
  return res.json({
    apiVersion: '1',
    requestId,
    serverTime: new Date().toISOString(),
    data: {
      currentUser,
      tenant,
      capabilities: capabilitiesByRole[user.role],
      featureFlags: {},
    },
  });
});

router.post('/sync/events', authenticate, async (req, res) => {
  const parsed = syncEventsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'INVALID_EVENT_BATCH', message: 'Event batch is invalid' },
    });
  }
  const tenantId = req.user!.tenantId;
  if (!tenantId) {
    return res.status(403).json({
      error: { code: 'TENANT_REQUIRED', message: 'A tenant account is required' },
    });
  }

  const account = await prisma.user.findFirst({
    where: { id: req.user!.userId, isActive: true },
    select: { id: true },
  });
  if (!account) {
    return res.status(404).json({
      error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' },
    });
  }

  try {
    const results = await ingestMobileEvents(tenantId, account.id, parsed.data.events);
    const requestIdHeader = req.header('x-request-id');
    const requestId = requestIdHeader && /^[A-Za-z0-9._:-]{1,128}$/.test(requestIdHeader)
      ? requestIdHeader
      : randomUUID();
    res.setHeader('x-request-id', requestId);
    return res.json({
      apiVersion: '1',
      requestId,
      serverTime: new Date().toISOString(),
      data: { results },
    });
  } catch (error) {
    if (error instanceof MobileEventConflictError) {
      return res.status(409).json({
        error: {
          code: 'EVENT_CONFLICT',
          message: error.message,
          details: { clientEventId: error.clientEventId },
        },
      });
    }
    throw error;
  }
});

export default router;
