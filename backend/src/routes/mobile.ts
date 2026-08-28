import { randomUUID } from 'crypto';
import { Router } from 'express';

import { authenticate } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

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

export default router;
