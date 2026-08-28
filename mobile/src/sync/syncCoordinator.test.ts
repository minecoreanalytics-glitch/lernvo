import { describe, expect, it } from 'vitest';

import type { TenantPartition } from '../storage/tenantPartition';
import type { OutboxEvent } from '../storage/repositories/eventOutboxRepository';
import { createSyncCoordinator, type SyncOutbox, type SyncTransport } from './syncCoordinator';

const partition: TenantPartition = { tenantId: 't1', userId: 'u1', key: 't1:u1' };
const event: OutboxEvent = {
  clientEventId: 'evt-1',
  eventType: 'SESSION_COMPLETED',
  payload: { durationSeconds: 120 },
  contentVersion: 2,
  createdAt: '2026-08-28T12:00:00.000Z',
  attemptCount: 0,
  nextAttemptAt: null,
  lastError: null,
};

class FakeOutbox implements SyncOutbox {
  events: OutboxEvent[] = [event];
  acknowledged: string[] = [];
  quarantined: string[] = [];
  retries: Array<{ id: string; at: string }> = [];

  async listPending() { return [...this.events]; }
  async acknowledge(_partition: TenantPartition, ids: string[]) {
    this.acknowledged.push(...ids);
    this.events = this.events.filter((item) => !ids.includes(item.clientEventId));
  }
  async quarantine(_partition: TenantPartition, id: string) {
    this.quarantined.push(id);
  }
  async recordRetry(_partition: TenantPartition, id: string, at: string) {
    this.retries.push({ id, at });
  }
}

function setup(overrides: {
  outbox?: FakeOutbox;
  transport?: SyncTransport;
  online?: boolean;
  getPartition?: () => TenantPartition | null;
  random?: () => number;
} = {}) {
  const outbox = overrides.outbox ?? new FakeOutbox();
  let calls = 0;
  const transport = overrides.transport ?? {
    async push(events) {
      calls += 1;
      return events.map((item) => ({
        clientEventId: item.clientEventId,
        status: 'accepted' as const,
        serverSequence: 1,
      }));
    },
  };
  const coordinator = createSyncCoordinator({
    outbox,
    transport,
    getPartition: overrides.getPartition ?? (() => partition),
    isOnline: () => overrides.online ?? true,
    now: () => new Date('2026-08-28T12:05:00.000Z'),
    random: overrides.random ?? (() => 0.5),
    batchSize: 20,
  });
  return { coordinator, outbox, get calls() { return calls; } };
}

describe('sync coordinator', () => {
  it('coalesces concurrent sync requests and acknowledges accepted events once', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const transport: SyncTransport = {
      async push(events) {
        calls += 1;
        await gate;
        return [{ clientEventId: events[0]!.clientEventId, status: 'accepted', serverSequence: 7 }];
      },
    };
    const { coordinator, outbox } = setup({ transport });

    const first = coordinator.sync();
    const second = coordinator.sync();
    release?.();
    await Promise.all([first, second]);

    expect(calls).toBe(1);
    expect(outbox.acknowledged).toEqual(['evt-1']);
    expect(coordinator.getStatus()).toBe('upToDate');
  });

  it('acknowledges exact duplicates and quarantines rejected poison events', async () => {
    const outbox = new FakeOutbox();
    outbox.events = [event, { ...event, clientEventId: 'evt-poison' }];
    const { coordinator } = setup({
      outbox,
      transport: {
        async push() {
          return [
            { clientEventId: 'evt-1', status: 'duplicate', serverSequence: 1 },
            { clientEventId: 'evt-poison', status: 'rejected', code: 'SERVER_AUTHORITY_REQUIRED' },
          ];
        },
      },
    });

    await coordinator.sync();

    expect(outbox.acknowledged).toEqual(['evt-1']);
    expect(outbox.quarantined).toEqual(['evt-poison']);
    expect(coordinator.getStatus()).toBe('attentionRequired');
  });

  it('uses bounded exponential backoff after transport failure', async () => {
    const outbox = new FakeOutbox();
    outbox.events = [{ ...event, attemptCount: 2 }];
    const { coordinator } = setup({
      outbox,
      random: () => 0.5,
      transport: { async push() { throw new Error('offline token=secret'); } },
    });

    await coordinator.sync();

    expect(outbox.retries).toEqual([
      { id: 'evt-1', at: '2026-08-28T12:05:04.125Z' },
    ]);
    expect(coordinator.getStatus()).toBe('offline');
  });

  it('does no network work while connectivity is offline', async () => {
    const state = setup({ online: false });

    await state.coordinator.sync();

    expect(state.calls).toBe(0);
    expect(state.coordinator.getStatus()).toBe('offline');
  });

  it('does not apply acknowledgements after the active account changes', async () => {
    let active = partition;
    const { coordinator, outbox } = setup({
      getPartition: () => active,
      transport: {
        async push() {
          active = { tenantId: 't2', userId: 'u2', key: 't2:u2' };
          return [{ clientEventId: 'evt-1', status: 'accepted', serverSequence: 1 }];
        },
      },
    });

    await coordinator.sync();

    expect(outbox.acknowledged).toEqual([]);
  });
});
