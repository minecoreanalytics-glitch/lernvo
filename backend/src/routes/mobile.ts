import { randomUUID } from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { authenticate } from '../middleware/auth';
import { signMediaCookie } from '../middleware/media';
import { ChatAssistantError, generateChatReply } from './chat';
import {
  ingestMobileEvents,
  MobileEventConflictError,
} from '../services/mobileEventIngestion';
import {
  acknowledgeAnnouncements,
  loadInbox,
  loadKbArticle,
  loadKbArticles,
  loadLeaderboard,
  loadLearnCatalog,
  loadModuleForLearner,
  loadProfile,
  loadQuizForLearner,
  loadTeamStatus,
  loadTodaySession,
  recordContentProgress,
  startModuleForLearner,
  submitQuizForLearner,
} from '../services/mobileLearner';
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
const askSchema = z.object({
  message: z.string().min(1).max(600),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000),
  })).max(10).default([]),
}).strict();
const readSchema = z.object({
  ids: z.array(z.string().min(1)).max(80).default([]),
}).strict();
const progressSchema = z.object({
  progressPct: z.number().min(0).max(100),
}).strict();
const submitSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().min(1),
    selectedOptionId: z.string().min(1),
  })).min(1),
  timeTaken: z.number().int().optional(),
}).strict();

const capabilitiesByRole = {
  AGENT: ['learn', 'ask', 'inbox'],
  SUPERVISOR: ['learn', 'ask', 'inbox', 'team'],
  MANAGER: ['learn', 'ask', 'inbox', 'team'],
  HR: ['learn', 'ask', 'inbox', 'team'],
  PLATFORM_MANAGER: ['learn', 'ask', 'inbox', 'team', 'admin'],
  SUPER_ADMIN: ['learn', 'ask', 'inbox', 'team', 'admin'],
} as const;

function requestIdFrom(req: Request) {
  const requestIdHeader = req.header('x-request-id');
  return requestIdHeader && /^[A-Za-z0-9._:-]{1,128}$/.test(requestIdHeader)
    ? requestIdHeader
    : randomUUID();
}

function sendEnvelope<T>(req: Request, res: Response, data: T, status = 200) {
  const requestId = requestIdFrom(req);
  res.setHeader('x-request-id', requestId);
  return res.status(status).json({
    apiVersion: '1',
    requestId,
    serverTime: new Date().toISOString(),
    data,
  });
}

function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return res.status(status).json({
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  });
}

router.get('/bootstrap', authenticate, async (req, res) => {
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
    return sendError(res, 404, 'BOOTSTRAP_NOT_FOUND', 'Account not found');
  }

  const { tenant, ...currentUser } = user;
  return sendEnvelope(req, res, {
    currentUser,
    tenant,
    capabilities: capabilitiesByRole[user.role],
    featureFlags: {},
  });
});

router.get('/today', authenticate, async (req, res) => {
  const session = await loadTodaySession(req.user!.userId);
  return sendEnvelope(req, res, { session });
});

router.get('/learn', authenticate, async (req, res) => {
  const catalog = await loadLearnCatalog(req.user!.userId);
  return sendEnvelope(req, res, catalog);
});

router.get('/kb', authenticate, async (req, res) => {
  const result = await loadKbArticles();
  return sendEnvelope(req, res, result);
});

router.get('/kb/:id', authenticate, async (req, res) => {
  const article = await loadKbArticle(req.params.id);
  if (!article) return sendError(res, 404, 'ARTICLE_NOT_FOUND', 'Document not found');
  return sendEnvelope(req, res, article);
});

router.get('/me', authenticate, async (req, res) => {
  const profile = await loadProfile(req.user!.userId);
  if (!profile) return sendError(res, 404, 'ACCOUNT_NOT_FOUND', 'Account not found');
  return sendEnvelope(req, res, profile);
});

router.get('/inbox', authenticate, async (req, res) => {
  const inbox = await loadInbox(req.user!.userId);
  return sendEnvelope(req, res, inbox);
});

router.post('/inbox/read', authenticate, async (req, res) => {
  const parsed = readSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return sendError(res, 400, 'INVALID_REQUEST', 'Acknowledgement payload is invalid');
  }
  const result = await acknowledgeAnnouncements(req.user!.userId, parsed.data.ids);
  return sendEnvelope(req, res, result);
});

router.get('/leaderboard', authenticate, async (req, res) => {
  const result = await loadLeaderboard(req.user!.userId, req.user!.role);
  return sendEnvelope(req, res, result);
});

// Media access for native clients: the web relies on the httpOnly `lernvo_media` cookie;
// the app appends this token as `?t=` on /uploads URLs (same signed payload, same checks).
router.get('/media-token', authenticate, async (req, res) => {
  const token = signMediaCookie({
    userId: req.user!.userId,
    tenantId: req.user!.tenantId,
    superAdmin: req.user!.role === 'SUPER_ADMIN',
  });
  return sendEnvelope(req, res, { token, expiresInSeconds: 7 * 24 * 3600 });
});

router.get('/team', authenticate, async (req, res) => {
  const result = await loadTeamStatus(req.user!.userId, req.user!.role);
  if (result.error === 'FORBIDDEN') {
    return sendError(res, 403, 'TEAM_FORBIDDEN', 'Team workspace is not available for this role');
  }
  return sendEnvelope(req, res, result.data);
});

router.post('/ask', authenticate, async (req, res) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'INVALID_REQUEST', 'Question payload is invalid');
  }
  try {
    const result = await generateChatReply({
      userId: req.user!.userId,
      message: parsed.data.message,
      history: parsed.data.history,
    });
    return sendEnvelope(req, res, result);
  } catch (error) {
    if (error instanceof ChatAssistantError) {
      const code = error.status === 503 ? 'ASSISTANT_UNAVAILABLE' : 'ASSISTANT_ERROR';
      return sendError(res, error.status, code, error.message);
    }
    const message = error instanceof Error ? error.message : '';
    if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      return sendError(res, 429, 'ASSISTANT_BUSY', 'The assistant is busy. Try again shortly.');
    }
    throw error;
  }
});

router.get('/modules/:id', authenticate, async (req, res) => {
  const module = await loadModuleForLearner(req.user!.userId, req.params.id);
  if (!module) return sendError(res, 404, 'MODULE_NOT_FOUND', 'Module not found');
  return sendEnvelope(req, res, module);
});

router.post('/modules/:id/start', authenticate, async (req, res) => {
  const enrollment = await startModuleForLearner(req.user!.userId, req.params.id);
  if (!enrollment) return sendError(res, 404, 'MODULE_NOT_FOUND', 'Module not found');
  return sendEnvelope(req, res, { enrollment });
});

router.post('/contents/:id/progress', authenticate, async (req, res) => {
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'INVALID_REQUEST', 'Progress payload is invalid');
  }
  const log = await recordContentProgress(
    req.user!.userId,
    req.params.id,
    parsed.data.progressPct,
  );
  if (!log) return sendError(res, 404, 'CONTENT_NOT_FOUND', 'Content not found');
  return sendEnvelope(req, res, { progress: log });
});

router.get('/quizzes/:id', authenticate, async (req, res) => {
  const quiz = await loadQuizForLearner(req.user!.userId, req.params.id);
  if (!quiz) return sendError(res, 404, 'QUIZ_NOT_FOUND', 'Quiz not found');
  if ('forbidden' in quiz) {
    return sendError(res, 403, 'NOT_ENROLLED', 'Enroll in the module before taking this quiz');
  }
  return sendEnvelope(req, res, quiz);
});

router.post('/quizzes/:id/submit', authenticate, async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'INVALID_REQUEST', 'Quiz answers are invalid');
  }
  const submitted = await submitQuizForLearner(
    req.user!.userId,
    req.params.id,
    parsed.data.answers,
    parsed.data.timeTaken,
  );
  if (submitted.error === 'NOT_FOUND') {
    return sendError(res, 404, 'QUIZ_NOT_FOUND', 'Quiz not found');
  }
  if (submitted.error === 'NOT_ENROLLED') {
    return sendError(res, 403, 'NOT_ENROLLED', 'Enroll in the module before taking this quiz');
  }
  if (submitted.error === 'ALREADY_PASSED') {
    return sendError(res, 403, 'ALREADY_PASSED', 'This quiz is already passed');
  }
  return sendEnvelope(req, res, submitted.result);
});

router.post('/sync/events', authenticate, async (req, res) => {
  const parsed = syncEventsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'INVALID_EVENT_BATCH', 'Event batch is invalid');
  }
  const tenantId = req.user!.tenantId;
  if (!tenantId) {
    return sendError(res, 403, 'TENANT_REQUIRED', 'A tenant account is required');
  }

  const account = await prisma.user.findFirst({
    where: { id: req.user!.userId, isActive: true },
    select: { id: true },
  });
  if (!account) {
    return sendError(res, 404, 'ACCOUNT_NOT_FOUND', 'Account not found');
  }

  try {
    const results = await ingestMobileEvents(tenantId, account.id, parsed.data.events);
    return sendEnvelope(req, res, { results });
  } catch (error) {
    if (error instanceof MobileEventConflictError) {
      return sendError(res, 409, 'EVENT_CONFLICT', error.message, {
        clientEventId: error.clientEventId,
      });
    }
    throw error;
  }
});

export default router;
