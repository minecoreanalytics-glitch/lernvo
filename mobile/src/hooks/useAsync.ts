import { useCallback, useEffect, useState } from 'react';

import { MobileApiError } from '../api/errors';
import { t } from '../i18n';

/** Human-readable, localized message for a failed request. */
export function describeError(caught: unknown): string {
  if (caught instanceof MobileApiError) {
    if (caught.code === 'NETWORK_UNAVAILABLE') return t('common.network');
    if (caught.code === 'AUTH_REFRESH_REQUIRED') return t('common.sessionExpired');
    return caught.message;
  }
  if (caught instanceof Error && caught.message) return caught.message;
  return t('common.somethingWrong');
}

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
