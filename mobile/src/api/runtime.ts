import { authService, authStore } from '../auth/authRuntime';
import { getPublicEnvironment } from '../config/env';
import { createMobileApiClient } from './client';

export const mobileApi = createMobileApiClient({
  baseUrl: getPublicEnvironment().apiUrl,
  getAccessToken: () => authService.getAccessToken(),
  getTenantSlug: () => authService.getTenantSlug(),
  refreshAccessToken: async () => {
    try {
      return await authService.refreshAccessToken();
    } catch {
      await authStore.getState().signOut();
      return null;
    }
  },
});
