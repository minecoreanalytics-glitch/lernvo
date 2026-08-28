import { getPublicEnvironment } from '../config/env';
import { createAuthService } from './authService';
import { createAuthStore } from './authStore';
import { createHttpAuthTransport } from './authTransport';
import { secureCredentialStore } from './secureCredentialStore';

const environment = getPublicEnvironment();

export const authService = createAuthService({
  store: secureCredentialStore,
  transport: createHttpAuthTransport({ baseUrl: environment.apiUrl }),
});

export const authStore = createAuthStore(authService);
