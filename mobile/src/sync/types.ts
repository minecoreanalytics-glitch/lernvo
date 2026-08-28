import type { OutboxEvent } from '../storage/repositories/eventOutboxRepository';

export type SyncStatus = 'offline' | 'syncing' | 'upToDate' | 'attentionRequired';

export type SyncResult =
  | { clientEventId: string; status: 'accepted' | 'duplicate'; serverSequence: number }
  | { clientEventId: string; status: 'rejected'; code: string };

export interface SyncTransport {
  push(events: OutboxEvent[], signal: AbortSignal): Promise<SyncResult[]>;
}

export interface SyncStatusSource {
  getStatus(): SyncStatus;
  subscribe(listener: () => void): () => void;
}
