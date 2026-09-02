import type { LocalDatabase } from '../database';
import type { TenantPartition } from '../tenantPartition';

export type OutboxEventInput = Readonly<{
  clientEventId: string;
  eventType: string;
  payload: unknown;
  contentVersion?: number;
  createdAt: string;
}>;

export type OutboxEvent = OutboxEventInput &
  Readonly<{ attemptCount: number; nextAttemptAt: string | null; lastError: string | null }>;

type OutboxRow = {
  client_event_id: string;
  event_type: string;
  payload: string;
  content_version: number | null;
  created_at: string;
  attempt_count: number;
  next_attempt_at: string | null;
  last_error: string | null;
};

export class EventOutboxRepository {
  constructor(private readonly database: LocalDatabase) {}

  async enqueue(partition: TenantPartition, event: OutboxEventInput) {
    await this.database.runAsync(
      `INSERT INTO event_outbox (
        tenant_id, user_id, client_event_id, event_type, payload, content_version, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      partition.tenantId,
      partition.userId,
      event.clientEventId,
      event.eventType,
      JSON.stringify(event.payload),
      event.contentVersion ?? null,
      event.createdAt,
    );
  }

  async listPending(partition: TenantPartition, now: string, limit: number): Promise<OutboxEvent[]> {
    const rows = await this.database.getAllAsync<OutboxRow>(
      `SELECT client_event_id, event_type, payload, content_version, created_at,
              attempt_count, next_attempt_at, last_error
       FROM event_outbox
       WHERE tenant_id = ? AND user_id = ? AND quarantined_at IS NULL
         AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY created_at ASC, client_event_id ASC
       LIMIT ?`,
      partition.tenantId,
      partition.userId,
      now,
      limit,
    );
    return rows.map((row) => ({
      clientEventId: row.client_event_id,
      eventType: row.event_type,
      payload: JSON.parse(row.payload),
      contentVersion: row.content_version ?? undefined,
      createdAt: row.created_at,
      attemptCount: row.attempt_count,
      nextAttemptAt: row.next_attempt_at,
      lastError: row.last_error,
    }));
  }

  async acknowledge(partition: TenantPartition, clientEventIds: string[]) {
    if (clientEventIds.length === 0) return;
    const placeholders = clientEventIds.map(() => '?').join(', ');
    await this.database.runAsync(
      `DELETE FROM event_outbox
       WHERE tenant_id = ? AND user_id = ? AND client_event_id IN (${placeholders})`,
      partition.tenantId,
      partition.userId,
      ...clientEventIds,
    );
  }

  async recordRetry(
    partition: TenantPartition,
    clientEventId: string,
    nextAttemptAt: string,
    error: string,
  ) {
    await this.database.runAsync(
      `UPDATE event_outbox
       SET attempt_count = attempt_count + 1, next_attempt_at = ?, last_error = ?
       WHERE tenant_id = ? AND user_id = ? AND client_event_id = ?`,
      nextAttemptAt,
      error.slice(0, 200),
      partition.tenantId,
      partition.userId,
      clientEventId,
    );
  }

  async quarantine(partition: TenantPartition, clientEventId: string, at: string, error: string) {
    await this.database.runAsync(
      `UPDATE event_outbox SET quarantined_at = ?, last_error = ?
       WHERE tenant_id = ? AND user_id = ? AND client_event_id = ?`,
      at,
      error.slice(0, 200),
      partition.tenantId,
      partition.userId,
      clientEventId,
    );
  }

  async wipeAccount(partition: TenantPartition) {
    await this.database.runAsync(
      'DELETE FROM event_outbox WHERE tenant_id = ? AND user_id = ?',
      partition.tenantId,
      partition.userId,
    );
  }
}
