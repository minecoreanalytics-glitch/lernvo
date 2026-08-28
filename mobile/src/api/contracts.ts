export type MobileEnvelope<T> = Readonly<{
  apiVersion: '1';
  data: T;
  requestId: string;
  serverTime: string;
}>;

export type MobileErrorBody = Readonly<{
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}>;

export function isMobileEnvelope<T>(value: unknown): value is MobileEnvelope<T> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;

  return (
    candidate.apiVersion === '1' &&
    'data' in candidate &&
    typeof candidate.requestId === 'string' &&
    typeof candidate.serverTime === 'string'
  );
}
