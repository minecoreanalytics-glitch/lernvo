import BetterSqlite3 from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import type { LocalDatabase } from '../database';
import { migrateDatabase } from '../migrations/001_initial';
import { tenantPartition } from '../tenantPartition';
import { BootstrapRepository } from './bootstrapRepository';
import { EventOutboxRepository } from './eventOutboxRepository';

class TestDatabase implements LocalDatabase {
  private readonly database = new BetterSqlite3(':memory:');

  async execAsync(sql: string) {
    this.database.exec(sql);
  }

  async runAsync(sql: string, ...params: unknown[]) {
    const result = this.database.prepare(sql).run(...params);
    return { changes: result.changes, lastInsertRowId: Number(result.lastInsertRowid) };
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]) {
    return (this.database.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]) {
    return this.database.prepare(sql).all(...params) as T[];
  }

  async withTransactionAsync(operation: () => Promise<void>) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      await operation();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

let database: TestDatabase;
let bootstrap: BootstrapRepository;
let outbox: EventOutboxRepository;
const ada = tenantPartition('tenant-a', 'user-ada');
const grace = tenantPartition('tenant-b', 'user-grace');

beforeEach(async () => {
  database = new TestDatabase();
  await migrateDatabase(database);
  bootstrap = new BootstrapRepository(database);
  outbox = new EventOutboxRepository(database);
});

describe('local database migration', () => {
  it('is forward-only and safe to run twice', async () => {
    await migrateDatabase(database);

    const version = await database.getFirstAsync<{ user_version: number }>(
      'PRAGMA user_version',
    );
    expect(version?.user_version).toBe(1);
  });
});

describe('tenant partition', () => {
  it('rejects empty or delimiter-bearing identifiers', () => {
    expect(() => tenantPartition('', 'user')).toThrow('tenantId');
    expect(() => tenantPartition('tenant:a', 'user')).toThrow('tenantId');
    expect(() => tenantPartition('tenant', '')).toThrow('userId');
  });

  it('creates a stable account-scoped key', () => {
    expect(tenantPartition('tenant-a', 'user-ada')).toEqual({
      tenantId: 'tenant-a',
      userId: 'user-ada',
      key: 'tenant-a:user-ada',
    });
  });
});

describe('bootstrap repository', () => {
  it('replaces one account cache without touching another tenant', async () => {
    await bootstrap.replace(ada, { revision: 1 });
    await bootstrap.replace(grace, { revision: 9 });
    await bootstrap.replace(ada, { revision: 2 });

    await expect(bootstrap.load(ada)).resolves.toEqual({ revision: 2 });
    await expect(bootstrap.load(grace)).resolves.toEqual({ revision: 9 });
  });
});

describe('event outbox repository', () => {
  it('returns due events in FIFO order and never crosses tenant partitions', async () => {
    await outbox.enqueue(ada, {
      clientEventId: 'evt-later',
      eventType: 'ANSWER_SUBMITTED',
      payload: { answer: 'B' },
      contentVersion: 3,
      createdAt: '2026-08-28T12:02:00.000Z',
    });
    await outbox.enqueue(ada, {
      clientEventId: 'evt-first',
      eventType: 'SESSION_STARTED',
      payload: {},
      contentVersion: 3,
      createdAt: '2026-08-28T12:01:00.000Z',
    });
    await outbox.enqueue(grace, {
      clientEventId: 'evt-other-tenant',
      eventType: 'SESSION_STARTED',
      payload: {},
      contentVersion: 1,
      createdAt: '2026-08-28T12:00:00.000Z',
    });

    const events = await outbox.listPending(
      ada,
      '2026-08-28T13:00:00.000Z',
      20,
    );

    expect(events.map((event) => event.clientEventId)).toEqual([
      'evt-first',
      'evt-later',
    ]);
    expect(events[0]?.payload).toEqual({});
  });

  it('acknowledges events and records retry metadata for later delivery', async () => {
    await outbox.enqueue(ada, {
      clientEventId: 'evt-retry',
      eventType: 'ANSWER_SUBMITTED',
      payload: { answer: 'A' },
      contentVersion: 2,
      createdAt: '2026-08-28T12:00:00.000Z',
    });
    await outbox.recordRetry(
      ada,
      'evt-retry',
      '2026-08-28T12:10:00.000Z',
      'network',
    );

    await expect(
      outbox.listPending(ada, '2026-08-28T12:05:00.000Z', 20),
    ).resolves.toEqual([]);
    const due = await outbox.listPending(
      ada,
      '2026-08-28T12:11:00.000Z',
      20,
    );
    expect(due[0]).toMatchObject({ attemptCount: 1, lastError: 'network' });

    await outbox.acknowledge(ada, ['evt-retry']);
    await expect(
      outbox.listPending(ada, '2026-08-28T13:00:00.000Z', 20),
    ).resolves.toEqual([]);
  });

  it('wipes only the selected account cache and outbox', async () => {
    await bootstrap.replace(ada, { ready: true });
    await bootstrap.replace(grace, { ready: true });
    await outbox.enqueue(ada, {
      clientEventId: 'evt-a',
      eventType: 'SESSION_STARTED',
      payload: {},
      createdAt: '2026-08-28T12:00:00.000Z',
    });

    await outbox.wipeAccount(ada);
    await bootstrap.wipeAccount(ada);

    await expect(bootstrap.load(ada)).resolves.toBeNull();
    await expect(bootstrap.load(grace)).resolves.toEqual({ ready: true });
    await expect(
      outbox.listPending(ada, '2026-08-28T13:00:00.000Z', 20),
    ).resolves.toEqual([]);
  });
});
