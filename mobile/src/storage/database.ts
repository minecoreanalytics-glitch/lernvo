import * as SQLite from 'expo-sqlite';

export interface LocalDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    ...params: unknown[]
  ): Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  withTransactionAsync(operation: () => Promise<void>): Promise<void>;
}

export async function openLocalDatabase(): Promise<LocalDatabase> {
  const database = await SQLite.openDatabaseAsync('lernvo.db');
  return database as unknown as LocalDatabase;
}
