import { useSyncExternalStore } from 'react';

import type { SyncStatusSource } from './types';

export function useSyncStatus(source: SyncStatusSource) {
  return useSyncExternalStore(source.subscribe, source.getStatus, source.getStatus);
}
