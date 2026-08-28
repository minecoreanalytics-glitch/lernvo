import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { createMobileApiClient } from '../api/client';
import { authService, authStore } from '../auth/authRuntime';
import { getPublicEnvironment } from '../config/env';
import { openLocalDatabase } from '../storage/database';
import { migrateDatabase } from '../storage/migrations/001_initial';
import { EventOutboxRepository } from '../storage/repositories/eventOutboxRepository';
import { tenantPartition } from '../storage/tenantPartition';
import { createConnectivityState } from './connectivity';
import { createSyncCoordinator } from './syncCoordinator';
import type { SyncStatus, SyncStatusSource } from './types';

type Coordinator = ReturnType<typeof createSyncCoordinator>;

const listeners = new Set<() => void>();
const connectivity = createConnectivityState(true);
let coordinator: Coordinator | null = null;
let initialization: Promise<Coordinator> | null = null;

export const syncStatusSource: SyncStatusSource = {
  getStatus: () => coordinator?.getStatus() ?? 'upToDate',
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

function notify() {
  listeners.forEach((listener) => listener());
}

export function initializeSyncRuntime() {
  if (initialization) return initialization;
  initialization = (async () => {
    const database = await openLocalDatabase();
    await migrateDatabase(database);
    const outbox = new EventOutboxRepository(database);
    const api = createMobileApiClient({
      baseUrl: getPublicEnvironment().apiUrl,
      getAccessToken: authService.getAccessToken,
      getTenantSlug: authService.getTenantSlug,
    });
    coordinator = createSyncCoordinator({
      outbox,
      isOnline: connectivity.isOnline,
      getPartition: () => {
        const user = authStore.getState().user;
        return user ? tenantPartition(user.tenantId, user.id) : null;
      },
      transport: {
        async push(events, signal) {
          const response = await api.request<{ results: Array<{
            clientEventId: string;
            status: 'accepted' | 'duplicate' | 'rejected';
            serverSequence?: number;
            code?: string;
          }> }>('/sync/events', {
            method: 'POST',
            signal,
            body: JSON.stringify({
              events: events.map((event) => ({
                clientEventId: event.clientEventId,
                eventType: event.eventType,
                occurredAt: event.createdAt,
                contentVersion: event.contentVersion,
                payload: event.payload,
              })),
            }),
          });
          return response.results.map((result) =>
            result.status === 'rejected'
              ? { clientEventId: result.clientEventId, status: 'rejected' as const, code: result.code ?? 'REJECTED' }
              : { clientEventId: result.clientEventId, status: result.status, serverSequence: result.serverSequence ?? 0 },
          );
        },
      },
    });
    coordinator.subscribe(notify);
    NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      connectivity.setOnline(online);
      if (online) void coordinator?.sync();
      notify();
    });
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void coordinator?.sync();
    });
    notify();
    return coordinator;
  })();
  return initialization;
}

export async function syncNow() {
  const activeCoordinator = await initializeSyncRuntime();
  await activeCoordinator.sync();
}

export function syncStatusLabel(status: SyncStatus) {
  if (status === 'syncing') return 'Syncing';
  if (status === 'offline') return 'Offline';
  if (status === 'attentionRequired') return 'Sync needs attention';
  return 'Up to date';
}
