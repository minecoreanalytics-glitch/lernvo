import { learnerApi, type BootstrapPayload } from '../api/learner';
import { authStore } from '../auth/authRuntime';
import { openLocalDatabase } from '../storage/database';
import { migrateDatabase } from '../storage/migrations/001_initial';
import { BootstrapRepository } from '../storage/repositories/bootstrapRepository';
import { tenantPartition } from '../storage/tenantPartition';

export async function refreshBootstrap(): Promise<BootstrapPayload | null> {
  const user = authStore.getState().user;
  if (!user) return null;
  const payload = await learnerApi.bootstrap();
  const database = await openLocalDatabase();
  await migrateDatabase(database);
  await new BootstrapRepository(database).replace(
    tenantPartition(user.tenantId, user.id),
    payload,
  );
  return payload;
}
