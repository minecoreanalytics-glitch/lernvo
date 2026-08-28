export interface ConnectivityState {
  isOnline(): boolean;
  setOnline(online: boolean): void;
  subscribe(listener: () => void): () => void;
}

export function createConnectivityState(initiallyOnline = true): ConnectivityState {
  let online = initiallyOnline;
  const listeners = new Set<() => void>();
  return {
    isOnline: () => online,
    setOnline(next) {
      if (online === next) return;
      online = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
