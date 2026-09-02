import type { OutboxEvent } from '../storage/repositories/eventOutboxRepository';
import type { TenantPartition } from '../storage/tenantPartition';
import type { SyncStatus, SyncTransport } from './types';

export type { SyncTransport } from './types';

export interface SyncOutbox {
  listPending(partition: TenantPartition, now: string, limit: number): Promise<OutboxEvent[]>;
  acknowledge(partition: TenantPartition, clientEventIds: string[]): Promise<void>;
  quarantine(partition: TenantPartition, clientEventId: string, at: string, error: string): Promise<void>;
  recordRetry(partition: TenantPartition, clientEventId: string, nextAttemptAt: string, error: string): Promise<void>;
}

export function createSyncCoordinator(options: {
  outbox: SyncOutbox;
  transport: SyncTransport;
  getPartition: () => TenantPartition | null;
  isOnline: () => boolean;
  now?: () => Date;
  random?: () => number;
  batchSize?: number;
}) {
  const now = options.now ?? (() => new Date());
  const random = options.random ?? Math.random;
  const batchSize = options.batchSize ?? 20;
  const listeners = new Set<() => void>();
  let status: SyncStatus = options.isOnline() ? 'upToDate' : 'offline';
  let activeSync: Promise<void> | null = null;
  let abortController: AbortController | null = null;

  function setStatus(next: SyncStatus) {
    if (status === next) return;
    status = next;
    listeners.forEach((listener) => listener());
  }

  async function runSync() {
    if (!options.isOnline()) {
      setStatus('offline');
      return;
    }
    const partition = options.getPartition();
    if (!partition) {
      setStatus('upToDate');
      return;
    }
    const events = await options.outbox.listPending(partition, now().toISOString(), batchSize);
    if (events.length === 0) {
      setStatus('upToDate');
      return;
    }

    setStatus('syncing');
    abortController = new AbortController();
    try {
      const results = await options.transport.push(events, abortController.signal);
      if (options.getPartition()?.key !== partition.key) return;

      const acknowledged = results
        .filter((result) => result.status === 'accepted' || result.status === 'duplicate')
        .map((result) => result.clientEventId);
      await options.outbox.acknowledge(partition, acknowledged);

      const rejected = results.filter((result) => result.status === 'rejected');
      for (const result of rejected) {
        await options.outbox.quarantine(
          partition,
          result.clientEventId,
          now().toISOString(),
          result.code,
        );
      }
      setStatus(rejected.length > 0 ? 'attentionRequired' : 'upToDate');
    } catch (error) {
      if (options.getPartition()?.key !== partition.key) return;
      const currentTime = now().getTime();
      for (const event of events) {
        const exponentialMs = Math.min(60_000, 2 ** event.attemptCount * 1_000);
        const jitterMs = Math.floor(random() * 250);
        await options.outbox.recordRetry(
          partition,
          event.clientEventId,
          new Date(currentTime + exponentialMs + jitterMs).toISOString(),
          error instanceof Error ? error.name : 'SyncError',
        );
      }
      setStatus('offline');
    } finally {
      abortController = null;
    }
  }

  return {
    sync() {
      if (activeSync) return activeSync;
      activeSync = runSync().finally(() => { activeSync = null; });
      return activeSync;
    },
    cancel() {
      abortController?.abort();
    },
    getStatus() {
      return status;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
