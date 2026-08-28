import { Prisma } from '@prisma/client';

import { sha256 } from '../utils/crypto';
import { prisma } from '../utils/prisma';

export type MobileLearningEventInput = Readonly<{
  clientEventId: string;
  eventType: string;
  occurredAt: string;
  contentId?: string;
  contentVersion?: number;
  payload: Record<string, unknown>;
}>;

export type MobileEventResult =
  | { clientEventId: string; status: 'accepted' | 'duplicate'; serverSequence: number }
  | { clientEventId: string; status: 'rejected'; code: 'SERVER_AUTHORITY_REQUIRED' };

const serverAuthorityKeys = new Set([
  'complianceStatus',
  'certificateGranted',
  'certificateId',
  'finalScore',
  'passed',
]);

function containsServerAuthorityField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsServerAuthorityField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, nested]) => serverAuthorityKeys.has(key) || containsServerAuthorityField(nested),
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function eventHash(event: MobileLearningEventInput) {
  return sha256(canonicalJson(event));
}

export class MobileEventConflictError extends Error {
  constructor(readonly clientEventId: string) {
    super('Client event ID was already used with different data');
    this.name = 'MobileEventConflictError';
  }
}

async function ingestOne(
  tenantId: string,
  userId: string,
  event: MobileLearningEventInput,
): Promise<MobileEventResult> {
  if (containsServerAuthorityField(event.payload)) {
    return {
      clientEventId: event.clientEventId,
      status: 'rejected',
      code: 'SERVER_AUTHORITY_REQUIRED',
    };
  }

  const payloadHash = eventHash(event);
  const existing = await prisma.mobileLearningEvent.findFirst({
    where: { userId, clientEventId: event.clientEventId },
    select: { payloadHash: true, serverSequence: true },
  });
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new MobileEventConflictError(event.clientEventId);
    }
    return {
      clientEventId: event.clientEventId,
      status: 'duplicate',
      serverSequence: existing.serverSequence,
    };
  }

  return prisma.$transaction(async (transaction) => {
    const duplicate = await transaction.mobileLearningEvent.findUnique({
      where: {
        tenantId_userId_clientEventId: {
          tenantId,
          userId,
          clientEventId: event.clientEventId,
        },
      },
      select: { payloadHash: true, serverSequence: true },
    });
    if (duplicate) {
      if (duplicate.payloadHash !== payloadHash) {
        throw new MobileEventConflictError(event.clientEventId);
      }
      return {
        clientEventId: event.clientEventId,
        status: 'duplicate' as const,
        serverSequence: duplicate.serverSequence,
      };
    }

    const cursor = await transaction.mobileSyncCursor.findUnique({ where: { userId } });
    const serverSequence = cursor?.nextSequence ?? 1;
    if (cursor) {
      await transaction.mobileSyncCursor.update({
        where: { id: cursor.id },
        data: { nextSequence: { increment: 1 } },
      });
    } else {
      await transaction.mobileSyncCursor.create({
        data: { tenantId, userId, nextSequence: 2 },
      });
    }

    await transaction.mobileLearningEvent.create({
      data: {
        tenantId,
        userId,
        clientEventId: event.clientEventId,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
        payloadHash,
        contentId: event.contentId,
        contentVersion: event.contentVersion,
        occurredAt: new Date(event.occurredAt),
        serverSequence,
      },
    });

    return { clientEventId: event.clientEventId, status: 'accepted' as const, serverSequence };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function ingestMobileEvents(
  tenantId: string,
  userId: string,
  events: MobileLearningEventInput[],
) {
  const results: MobileEventResult[] = [];
  for (const event of events) results.push(await ingestOne(tenantId, userId, event));
  return results;
}
