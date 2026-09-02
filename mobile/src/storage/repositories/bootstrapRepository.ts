import type { LocalDatabase } from '../database';
import type { TenantPartition } from '../tenantPartition';

export class BootstrapRepository {
  constructor(private readonly database: LocalDatabase) {}

  async replace(partition: TenantPartition, payload: unknown) {
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `INSERT INTO bootstrap_cache (tenant_id, user_id, payload, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
        partition.tenantId,
        partition.userId,
        JSON.stringify(payload),
        new Date().toISOString(),
      );
    });
  }

  async load<T>(partition: TenantPartition): Promise<T | null> {
    const row = await this.database.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM bootstrap_cache WHERE tenant_id = ? AND user_id = ?',
      partition.tenantId,
      partition.userId,
    );
    return row ? (JSON.parse(row.payload) as T) : null;
  }

  async wipeAccount(partition: TenantPartition) {
    await this.database.runAsync(
      'DELETE FROM bootstrap_cache WHERE tenant_id = ? AND user_id = ?',
      partition.tenantId,
      partition.userId,
    );
  }
}
