import type { LocalDatabase } from '../database';

const migration = `
  CREATE TABLE IF NOT EXISTS bootstrap_cache (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS event_outbox (
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    client_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    content_version INTEGER,
    created_at TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    last_error TEXT,
    quarantined_at TEXT,
    PRIMARY KEY (tenant_id, user_id, client_event_id)
  );

  CREATE INDEX IF NOT EXISTS event_outbox_delivery
    ON event_outbox (tenant_id, user_id, quarantined_at, next_attempt_at, created_at);
`;

export async function migrateDatabase(database: LocalDatabase) {
  const current = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  if ((current?.user_version ?? 0) >= 1) return;

  await database.withTransactionAsync(async () => {
    await database.execAsync(migration);
    await database.execAsync('PRAGMA user_version = 1');
  });
}
