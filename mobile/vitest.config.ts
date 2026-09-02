import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // better-sqlite3 (native) runs in the repository tests. Worker threads keep the
    // native module in-process and avoid the tinypool fork teardown race seen on
    // GitHub-hosted runners ("Channel closed", ERR_IPC_CHANNEL_CLOSED).
    pool: 'threads',
    fileParallelism: false,
    testTimeout: 20000,
  },
});
