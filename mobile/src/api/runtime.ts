import { authService, authStore } from '../auth/authRuntime';
import { getPublicEnvironment } from '../config/env';
import { createMobileApiClient } from './client';

const shared = {
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
};

/** Versioned mobile API (`/api/mobile/v1`, enveloped responses). */
export const mobileApi = createMobileApiClient(shared);

/** The web application's own API (`/api/*`), same JWT, raw JSON. Used for screens the
 *  web already serves (notifications, assignments, departments, pricing, career, search). */
export const webApi = createMobileApiClient({ ...shared, basePath: '/api', envelope: false });
